import {Injectable} from "@nestjs/common";
import {randomInt, randomUUID} from "node:crypto";
import {PrismaService} from "../prisma/prisma.service.js";

import type {StartGameRequest, StartGameResponse} from "./contracts/start-game.interface.js";
import type {GameRole, PlayerGameState} from "./contracts/player-game-state.interface.js";
import type {AcceptedClue} from "./contracts/clue.interface.js";

// Predefined backend word list for the game
const SECRET_WORDS = ["apple", "banana", "cherry", "ocean", "mountain", "river", "forest", "desert", "city", "village", "pizza", "pasta", "burger"];

@Injectable()
export class GameService
{

	constructor(private readonly prisma: PrismaService,)
	{
	}

	async startGame(request: StartGameRequest): Promise<StartGameResponse>
	{
		// Validate the request
		if (!request || typeof request.roomId !== "string" || request.roomId.trim() === "" || !Array.isArray(request.participantIds) || request.participantIds.some(id => !Number.isSafeInteger(id) || id <= 0))
		{
			throw new Error("INVALID_START_REQUEST");
		}

		const ids = request.participantIds;

		if (ids.length < 3 || ids.length > 8)
		{
			throw new Error("INVALID_PLAYER_COUNT");
		}

		if (new Set(ids).size !== ids.length)
		{
			throw new Error("DUPLICATE_PLAYERS");
		}

		// Check existing game
		const existingGame = await this.prisma.game.findUnique(
		{
			where:
			{
				roomId: request.roomId,
			},
			select:
			{
				id: true,
			},
		});

		if (existingGame)
		{
			throw new Error("GAME_ALREADY_ACTIVE");
		}

		// Assign roles
		const spyIndex = randomInt(ids.length);

		const players: 
		{
  			userId: number;
  			role: GameRole;
		}[] = ids.map((userId, index) => ({userId, role: index === spyIndex ? "SPY" : "DETECTIVE"}));

		// Choose secret word
		const secretWord = SECRET_WORDS[randomInt(SECRET_WORDS.length)];

		// Prepare initial values
		const gameId = randomUUID();
		const startedAt = new Date();
		const phaseEndsAt = new Date(startedAt.getTime() + 60_000); 

		// Store the game temporarily
		try
		{
			await this.prisma.game.create(
			{
				data:
				{
					id: gameId,
					room:
					{
						connect:
						{
							id: request.roomId,
						},
					},
					phase: "CLUE_SUBMISSION",
					currentRoundNumber: 1,
					secretWord,
					phaseEndsAt,
					startedAt,
					players:
					{
						create: players.map(player => (
						{
							role: player.role,
							participationStatus: "ACTIVE",
							connectionStatus: "CONNECTED",
							user:
							{
								connect:
								{
									id: player.userId,
								},
							},
						})),
					},
					rounds:
					{
						create:
						{
							number: 1,
						},
					},
				},
			});
		}
		catch (error)
		{
			// Handle a duplicate room game, including concurrent starts.
			if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002")
			{
				throw new Error("GAME_ALREADY_ACTIVE");
			}
			throw error;
		}

		// Return only public game information
		return {
			gameId,
			roomId: request.roomId,
			phase: "CLUE_SUBMISSION",
			roundNumber: 1,
			phaseEndsAt: phaseEndsAt.toISOString(),
		};
	}

	async getPlayerState(gameId: string, userId: number): Promise<PlayerGameState>
	{
		// Find the game in PostgreSQL
		const game = await this.prisma.game.findUnique(
		{
			where:
			{
				id: gameId,
			},
			select:
			{
				id: true,
				phase: true,
				currentRoundNumber: true,
				phaseEndsAt: true,
				secretWord: true,
			},
		});
		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Check that this player belongs to the game
		const player = await this.prisma.gamePlayer.findUnique(
		{
			where:
			{
				gameId_userId: 
				{
					gameId,
					userId,
				},
			},
			select:
			{
				role: true,
			},
		});
	
		if (!player)
		{
			throw new Error("NOT_GAME_PARTICIPANT");
		}

		// Retrieve clues from the current round
		const round = await this.prisma.gameRound.findUnique(
		{
			where:
			{
				gameId_number:
				{
					gameId,
					number: game.currentRoundNumber,
				},
			},
			select:
			{
				clues:
				{
					select:
					{
						text: true,
						author: 
						{
							select:
							{
								userId: true,
							},
						},
					},
				},
			},
		});

		if (!round)
		{
			throw new Error("ROUND_NOT_FOUND");
		}

		// Convert database clues into our contract
		const clues = round.clues.map(c => (
		{
			gameId: game.id,
			roundNumber: game.currentRoundNumber,
			userId: c.author.userId,
			clue: c.text,
		}));

		// Build a safe response for this player
		const state: PlayerGameState =
		{
			gameId: game.id,
			phase: game.phase,
			roundNumber: game.currentRoundNumber,
			phaseEndsAt: game.phaseEndsAt?.toISOString() ?? null,
			role: player.role,
			clues,
			hasSubmittedClue: clues.some(c => c.userId === userId),
		};

		// Only Detectives receive the secret word
		if (player.role === "DETECTIVE")
		{
			state.secretWord = game.secretWord;
		}
		
		return state;
	}

	async submitClue(gameId: string, userId: number, clue: string, nowMs: number = Date.now()): Promise<AcceptedClue>
	{
		// Find the game
		const game = await this.prisma.game.findUnique(
		{
			where:
			{
				id : gameId,
			},
			select:
			{
				phase: true,
				currentRoundNumber: true,
				phaseEndsAt: true,
			},
		});

		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Find the player
		const player = await this.prisma.gamePlayer.findUnique(
		{
			where:
			{
				gameId_userId : 
				{
					gameId,
					userId
				},
			},
			select:
			{
				id: true,
				participationStatus: true,
				connectionStatus: true,
			},
		});

		if (!player)
		{
			throw new Error("NOT_GAME_PARTICIPANT");
		}

		if (player.participationStatus !== "ACTIVE" || player.connectionStatus !== "CONNECTED")
		{
			throw new Error("PLAYER_NOT_ELIGIBLE");
		}

		// Check phase and deadline
		if (game.phase !== "CLUE_SUBMISSION")
		{
			throw new Error("INVALID_PHASE");
		}

		if (game.phaseEndsAt === null || nowMs >= game.phaseEndsAt.getTime())
		{
			throw new Error("PHASE_EXPIRED");
		}

		// Validate clue
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

		// find the current round
		const round = await this.prisma.gameRound.findUnique(
		{
			where:
			{
				gameId_number: 
				{
					gameId,
					number: game.currentRoundNumber,
				}
			},
			select:
			{
				id: true,
			},
		});

		if (!round)
		{
			throw new Error("ROUND_NOT_FOUND");
		}

		// Save the clue to PostgreSQL
		try
		{
			await this.prisma.clue.create(
			{
				data:
				{
					roundId: round.id,
					authorGamePlayerId: player.id,
					text: cleanClue,
					normalizedText: cleanClue.toLowerCase(),
					submittedAt: new Date(nowMs),
				},
			});
		}
		catch (error)
		{
			// PostgreSQL rejected a duplicate.
			if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002")
			{
				const previousClue = await this.prisma.clue.findUnique(
				{
					where:
					{
						roundId_authorGamePlayerId:
						{
							roundId: round.id,
							authorGamePlayerId: player.id,
						},
					},
					select:
					{
						id: true,
					},
				});
				if (previousClue)
				{
					throw new Error("CLUE_ALREADY_SUBMITTED");
				}
				throw new Error("DUPLICATE_CLUE");
			}
			throw error;
		}

		// Return the accepted clue
		return {
			gameId,
			roundNumber: game.currentRoundNumber,
			userId,
			clue: cleanClue,
		};
	}

	async submitVote(gameId: string, voterUserId: number, targetUserId: number, nowMs: number = Date.now()): Promise<void>
	{
		// Validate IDs
		if (typeof gameId !== "string" || gameId.trim() === "" || !Number.isSafeInteger(voterUserId) || voterUserId <= 0 || !Number.isSafeInteger(targetUserId) || targetUserId <= 0)
		{
			throw new Error("INVALID_VOTE_REQUEST");
		}

		// Find the game
		const game = await this.prisma.game.findUnique(
		{
			where:
			{
				id : gameId,
			},
			select:
			{
				phase: true,
				currentRoundNumber: true,
				phaseEndsAt: true,
			},
		});

		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Check the voting phase
		if (game.phase !== "VOTING")
		{
			throw new Error("INVALID_PHASE");
		}

		// Check the voting deadline
		if (game.phaseEndsAt === null || nowMs >= game.phaseEndsAt.getTime())
		{
			throw new Error("PHASE_EXPIRED");
		}

		// Find the voter in this game
		const voter = await this.prisma.gamePlayer.findUnique(
		{
			where:
			{
				gameId_userId : 
				{
					gameId,
					userId: voterUserId,
				},
			},
			select:
			{
				id: true,
				participationStatus: true,
				connectionStatus: true,
			},
		});
		
		if (!voter)
		{
			throw new Error("NOT_GAME_PARTICIPANT");
		}

		// Check whether the voter can vote
		if (voter.participationStatus !== "ACTIVE" || voter.connectionStatus !== "CONNECTED")
		{
			throw new Error("VOTER_NOT_ELIGIBLE");
		}

		// Find the target player in the same game
		const target = await this.prisma.gamePlayer.findUnique(
		{
			where:
			{
				gameId_userId : 
				{
					gameId,
					userId: targetUserId,
				},
			},
			select:
			{
				id: true,
				participationStatus: true,
			},
		});

		// Find the current round
		const round = await this.prisma.gameRound.findUnique(
		{
			where:
			{
				gameId_number: 
				{
					gameId,
					number: game.currentRoundNumber,
				}
			},
			select:
			{
				id: true,
			},
		});

		if (!round)
		{
			throw new Error("ROUND_NOT_FOUND");
		}

		if (!target) 
		{
			throw new Error('INVALID_VOTE_TARGET');
		}

		if (target.participationStatus !== 'ACTIVE') 
		{
			throw new Error('INVALID_VOTE_TARGET');
		}

		// Save the private vote
		try
		{
			await this.prisma.vote.create(
			{
				data:
				{
					roundId: round.id,
					voterGamePlayerId: voter.id,
					targetGamePlayerId: target.id,
					submittedAt: new Date(nowMs),
				},
			});
		}
		catch (error)
		{
			// One vote per player per round
			if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002")
			{
				throw new Error("VOTE_ALREADY_SUBMITTED");
			}
			throw error;
		}
	}

	async advancePhaseIfExpired(gameId: string, nowMs: number = Date.now()): Promise<boolean>
	{
		// Find the game
		const game = await this.prisma.game.findUnique(
		{
			where:
			{
				id : gameId,
			},
			select:
			{
				phase: true,
				phaseEndsAt: true,
			},
		});

		if (!game)
		{
			throw new Error("GAME_NOT_FOUND");
		}

		// Check the deadline
		if (game.phaseEndsAt === null)
		{
			return false;
		}

		const deadlineMs = game.phaseEndsAt.getTime();

		if (nowMs < deadlineMs)
		{
			return false;
		}

		// Determine the next phase

		let nextPhase: "DISCUSSION" | "VOTING";
		let durationMs: number;

		if (game.phase === "CLUE_SUBMISSION")
		{
			nextPhase = "DISCUSSION";
			durationMs = 120_000;
		}
		else if (game.phase === "DISCUSSION")
		{
			nextPhase = "VOTING";
			durationMs = 30_000;
		}
		else if (game.phase === "VOTING")
		{
			throw new Error("ROUND_RESOLUTION_NOT_IMPLEMENTED");
		}
		else
		{
			return false;
		}

		// Update the game in PostgreSQL
		const result = await this.prisma.game.updateMany(
		{
			where:
			{
				id: gameId,
				phase: game.phase,
				phaseEndsAt: game.phaseEndsAt,
			},
			data:
			{
				phase: nextPhase,
				phaseEndsAt: new Date(deadlineMs + durationMs),
			},
		});

		// Exactly one game must have been updated.
		return result.count === 1;
	}
}

