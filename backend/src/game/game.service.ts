import {Injectable} from "@nestjs/common";
import {randomInt, randomUUID} from "node:crypto";

import type {StartGameRequest, StartGameResponse} from "./contracts/start-game.interface.js";
import type {GameRole, PlayerGameState} from "./contracts/player-game-state.interface.js";
import type {GamePhase} from "./contracts/game-phase.type.js";
import type {AcceptedClue} from "./contracts/clue.interface.js";

// Internal representation of a player
interface GamePlayer
{
	userId: number;
	role: GameRole;
	participationStatus: "ACTIVE" | "ELIMINATED" | "DEPARTED";
	connectionStatus: "CONNECTED" | "DISCONNECTED";
}

// Internal game data (never returned directly to M4)
interface GameData
{
	id: string;
	roomId: string;
	players: GamePlayer[];
	secretWord: string;
	phase: GamePhase;
	roundNumber: number;
	phaseEndsAt: string | null;
	clues: AcceptedClue[];
}

// Predefined backend word list for the game
const SECRET_WORDS = ["apple", "banana", "cherry", "ocean", "mountain", "river", "forest", "desert", "city", "village", "pizza", "pasta", "burger"];

@Injectable()
export class GameService
{
	// Temporary storage until Prisma is integrated
	private readonly games = new Map<string, GameData>();

	async startGame(request: StartGameRequest): Promise<StartGameResponse>
	{
		// Validate the request structure
		if (!request || typeof request.roomId !== "string" || request.roomId.trim() === "" || !Array.isArray(request.participantIds) || request.participantIds.some(id => !Number.isSafeInteger(id) || id <= 0))
		{
			throw new Error("INVALID_START_REQUEST");
		}

		const ids = request.participantIds;

		// Validate the number of participants
		if (ids.length < 3 || ids.length > 8)
		{
			throw new Error("INVALID_PLAYER_COUNT");
		}

		// Validate the uniqueness of participant IDs
		if (new Set(ids).size !== ids.length)
		{
			throw new Error("DUPLICATE_PLAYERS");
		}

		// Prevent another game for this room
		if (this.games.has(request.roomId))
		{
			throw new Error("GAME_ALREADY_ACTIVE");
		}

		// Randomly select the Spy
		const spyIndex = randomInt(ids.length);
		const players: GamePlayer[] = ids.map((userId, index) => ({userId, role: index === spyIndex ? "SPY" : "DETECTIVE", participationStatus: "ACTIVE", connectionStatus: "CONNECTED"}));

		// Randomly select a secret word
		const wordIndex = randomInt(SECRET_WORDS.length);
		const secretWord = SECRET_WORDS[wordIndex];

		// Prepare the initial phase and deadline
		const initialPhase = "CLUE_SUBMISSION";
		const initialDeadline = new Date(Date.now() + 60 * 1000).toISOString();

		// Create the game
		const game: GameData =
		{
			id: randomUUID(),
			roomId: request.roomId,
			players,
			secretWord,
			phase: initialPhase,
			roundNumber: 1,
			phaseEndsAt: initialDeadline,
			clues: [],
		};

		// Store the game temporarily
		this.games.set(request.roomId, game);

		// Return only public game information
		return {
			gameId: game.id,
			roomId: game.roomId,
			phase: initialPhase,
			roundNumber: game.roundNumber,
			phaseEndsAt: initialDeadline,
		}
	};

	getPlayerState(gameId: string, userId: number): PlayerGameState
	{
		// Find the game
		const game = [...this.games.values()].find(game => game.id === gameId);
		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Find this player inside the game
		const player = game.players.find(player => player.userId === userId);
		if (!player)
		{
			throw new Error("NOT_GAME_PARTICIPANT");
		}

		const currentClues = game.clues.filter(c => c.roundNumber === game.roundNumber);

		// Build the player's private response
		const state: PlayerGameState =
		{
			gameId: game.id,
			phase: game.phase,
			roundNumber: game.roundNumber,
			phaseEndsAt: game.phaseEndsAt,
			role: player.role,
			clues: currentClues.map(c => ({...c})),
			hasSubmittedClue: currentClues.some(c => c.userId === userId),
		};

		// Only Detectives receive the secret word
		if (player.role === "DETECTIVE")
		{
			state.secretWord = game.secretWord;
		}

		return state;
	};

	advancePhaseIfExpired(gameId: string, nowMs: number = Date.now()): boolean
	{
		// Find the game
		const game = [...this.games.values()].find(game => game.id === gameId);
		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Check whether this phase has a deadline
		if (game.phaseEndsAt === null)
		{
			return false;
		}

		const deadlineMs = Date.parse(game.phaseEndsAt);

		// Don't advance before the deadline
		if (nowMs < deadlineMs)
		{
			return false;
		}

		// Clue Submission -> Discussion
		if (game.phase === "CLUE_SUBMISSION")
		{
			game.phase = "DISCUSSION";
			game.phaseEndsAt = new Date(nowMs + 120 * 1000).toISOString();
			return true;
		}

		// Discussion -> Voting
		if (game.phase === "DISCUSSION")
		{
			game.phase = "VOTING";
			game.phaseEndsAt = new Date(nowMs + 30 * 1000).toISOString();
			return true;
		}

		// Voting will require round resolution
		if (game.phase === "VOTING")
		{
			throw new Error("ROUND_RESOLUTION_NOT_IMPLEMENTED");
		}

		return false;
	}

	submitClue(gameId: string, userId: number, clue: string, nowMs: number = Date.now()): AcceptedClue
	{
		// Find the game
		const game = [...this.games.values()].find(game => game.id === gameId);
		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Find the player
		const player = game.players.find(player => player.userId === userId);
		if (!player)
		{
			throw new Error("NOT_GAME_PARTICIPANT");
		}

		// check player eligibility
		if (player.participationStatus !== "ACTIVE" || player.connectionStatus !== "CONNECTED")
		{
			throw new Error("PLAYER_NOT_ELIGIBLE");
		}

		// Check the current phase
		if (game.phase !== "CLUE_SUBMISSION")
		{
			throw new Error("INVALID_PHASE");
		}

		// check the deadline
		if (game.phaseEndsAt === null || nowMs >= Date.parse(game.phaseEndsAt))
		{
			throw new Error("PHASE_EXPIRED");
		}

		// Validate the clue text
		if (typeof clue !== "string")
		{
			throw new Error("INVALID_CLUE");
		}

		const cleanClue = clue.trim();

		if (cleanClue.length === 0)
		{
			throw new Error("EMPTY_CLUE");
		}

		if (cleanClue.length > 100)
		{
			throw new Error("CLUE_TOO_LONG");
		}

		// Get clues from the current round
		const currentClues = game.clues.filter(c => c.roundNumber === game.roundNumber);

		// One clue per player per round
		const alreadySubmitted = currentClues.some(c => c.userId === userId);
		if (alreadySubmitted)
		{
			throw new Error("CLUE_ALREADY_SUBMITTED");
		}

		// Reject duplicate clues (case-insensitive)
		const duplicate = currentClues.some(c => c.clue.toLowerCase() === cleanClue.toLowerCase());
		if (duplicate)
		{
			throw new Error("DUPLICATE_CLUE");
		}

		// Create the accepted clue
		const acceptedClue: AcceptedClue =
		{
			gameId: game.id,
			roundNumber: game.roundNumber,
			userId: userId,
			clue: cleanClue
		};

		// Store the clue
		game.clues.push(acceptedClue);

		return {... acceptedClue};
	}
}

