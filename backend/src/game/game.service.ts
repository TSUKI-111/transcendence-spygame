import {Injectable} from "@nestjs/common";
import {randomInt, randomUUID} from "node:crypto";
import {PrismaService} from "../prisma/prisma.service.js";

import {calculateVotingOutcome} from "./round-resolution.js";

import type {StartGameRequest, StartGameResponse} from "./contracts/start-game.interface.ts";
import type {GameRole, PlayerGameState} from "./contracts/player-game-state.interface.ts";
import type {AcceptedClue} from "./contracts/clue.interface.ts";
import type {RoundResolutionResult} from "./contracts/round-resolution.interface.ts";
import type {GameFinalResult} from "./contracts/game-final-result.interface.ts";

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

	
	async resolveRound(gameId: string, nowMs: number = Date.now()): Promise<RoundResolutionResult> 
	{
		return this.prisma.$transaction(async tx => 
		{

	    	// Read the game and all its original players
			const game = await tx.game.findUnique(
			{
				where: 
				{ 
					id: gameId 
				},
				select: 
				{
					roomId: true,
					phase: true,
					currentRoundNumber: true,
					phaseEndsAt: true,
					players: 
					{
						select: 
						{
							id: true,
							userId: true,
							role: true,
							participationStatus: true,
							connectionStatus: true,
						},
					},
				},
			});
			if (!game) 
			{
				throw new Error('GAME_NOT_FOUND');
			}

			if (game.phase !== 'VOTING') 
			{
				throw new Error('INVALID_PHASE');
			}

			if (game.phaseEndsAt === null || nowMs < game.phaseEndsAt.getTime()) 
			{
				throw new Error('PHASE_NOT_EXPIRED');
			}

	    	// Read the current round
			const round = await tx.gameRound.findUnique(
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
					id: true 
				},
			});
			
			if (!round) 
			{
				throw new Error('ROUND_NOT_FOUND');
			}

	    	// Read all votes from this round
			const votes = await tx.vote.findMany(
			{
				where: 
				{ 
					roundId: round.id 
				},
				select: 
				{
					targetGamePlayerId: true,
				},
			});

	    	// Players disconnected at resolution depart.
			const disconnected = game.players.filter(player => player.participationStatus === 'ACTIVE' && player.connectionStatus === 'DISCONNECTED');

			const activePlayers = game.players.filter(player => player.participationStatus === 'ACTIVE' && player.connectionStatus === 'CONNECTED');

	    	// Departures may terminate the game.
			let reason: GameFinalResult['reason'] = null;

			if (disconnected.some(player => player.role === 'SPY')) 
			{
				reason = 'SPY_DEPARTED';
			} 
			else if (activePlayers.length <= 2) 
			{
				reason = 'INSUFFICIENT_PLAYERS';
			}

		    // 6. Count votes only if the game can continue.
			const result = reason === null ? calculateVotingOutcome(activePlayers, votes) : null;

			const eliminated = result?.eliminated ?? null;

			// 7. Determine the winner, if any.
			let winner: GameFinalResult['winner'] = null;

			if (reason === null && eliminated) 
			{
				if (eliminated.role === 'SPY') 
				{
					winner = 'DETECTIVES';
				}
				else if (activePlayers.length - 1 <= 2) 
				{
					winner = 'SPY';
				}
			}

	    	// Choose the next game phase.
			const nextPhase: 'CLUE_SUBMISSION' | 'FINISHED' | 'TERMINATED' = reason !== null ? 'TERMINATED' : winner !== null ? 'FINISHED' : 'CLUE_SUBMISSION';

			const endedAt = new Date(nowMs);

	   			// A new round starts with a fresh 60-second deadline.
					const nextDeadline = nextPhase === 'CLUE_SUBMISSION' ? new Date(nowMs + 60_000) : null;

	    	// Claim this round resolution.
			const updated = await tx.game.updateMany(
			{
				where: 
				{
					id: gameId,
					phase: 'VOTING',
					phaseEndsAt: game.phaseEndsAt,
				},
				data: 
				{
					phase: nextPhase,
					currentRoundNumber:
						nextPhase === 'CLUE_SUBMISSION' ? game.currentRoundNumber + 1 : game.currentRoundNumber,
					phaseEndsAt: nextDeadline,
					winner,
					terminationReason: reason,
					endedAt: nextPhase === 'CLUE_SUBMISSION' ? null : endedAt,
				},
			});

			if (updated.count !== 1) 
			{
				throw new Error('ROUND_ALREADY_RESOLVED');
			}

	    // Permanently remove disconnected participants from gameplay, but keep their historical records.
		if (disconnected.length > 0) 
		{
			await tx.gamePlayer.updateMany(
			{
				where: 
				{
					gameId,
					participationStatus: 'ACTIVE',
					connectionStatus: 'DISCONNECTED',
				},
				data: 
				{
					participationStatus: 'DEPARTED',
				},
			});
		}

	    // Save the voting outcome. If the game terminated due to departures, the round remains unresolved.
		if (reason === null && result) 
		{
			await tx.gameRound.update(
			{
				where: 
				{ 
					id: round.id 
				},
				data: 
				{
					outcome: result.outcome,
					eliminatedGamePlayerId: eliminated?.id ?? null,
					resolvedAt: endedAt,
				},
			});

			if (eliminated) 
			{
				await tx.gamePlayer.update(
				{
					where: 
					{
						id: eliminated.id 
					},
					data: 
					{
						participationStatus: 'ELIMINATED',
					},
				});
			}

	      	// Create Round 2, Round 3, etc.
			if (nextPhase === 'CLUE_SUBMISSION') 
			{
				await tx.gameRound.create(
				{
					data: 
					{
						gameId,
						number: game.currentRoundNumber + 1,
					},
				});
			}
		}

			// Build the final result for M4, if terminal.
			const finalResult: GameFinalResult | null = nextPhase === 'CLUE_SUBMISSION' ? null: 
			{
				gameId,
				roomId: game.roomId,
				status: nextPhase,
				winner,
				reason,
				endedAt: endedAt.toISOString(),
			};

			return {
				gameId,
				roundNumber: game.currentRoundNumber,
				outcome: result?.outcome ?? null,
				eliminatedUserId: eliminated?.userId ?? null,
				eliminatedRole: eliminated?.role ?? null,
				nextPhase,
				phaseEndsAt: nextDeadline?.toISOString() ?? null,
				finalResult,
			};

	}, 
	{
		isolationLevel: 'Serializable'
	});
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
			await this.resolveRound(gameId, nowMs);
			return true;
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

