import {Injectable} from "@nestjs/common";
import {randomInt, randomUUID} from "node:crypto";
import {PrismaService} from "../prisma/prisma.service.js";

import {calculateVotingOutcome} from "./round-resolution.js";
import {GameEventsService} from "./game-events.service.js";
import {retryOnTransactionConflict} from "./prisma-transaction-retry.js";
import {lockGame} from "./game-lock.js";

import type {StartGameRequest, StartGameResponse} from "./contracts/start-game.interface.ts";
import type {GameRole, PlayerGameState} from "./contracts/player-game-state.interface.ts";
import type {AcceptedClue} from "./contracts/clue.interface.ts";
import type {RoundResolutionResult} from "./contracts/round-resolution.interface.ts";
import type {GameFinalResult} from "./contracts/game-final-result.interface.ts";
import type {LeaveGameResult} from "./contracts/leave-game-result.interface.ts";
import type {ClientGameResult} from "./contracts/client-game-result.interface.ts";

// Predefined backend word list for the game
const SECRET_WORDS = ["apple", "banana", "cherry", "ocean", "mountain", "river", "forest", "desert", "city", "village", "pizza", "pasta", "burger"];

@Injectable()
export class GameService
{

	constructor(
		private readonly prisma: PrismaService,
		private readonly events: GameEventsService,
	) {}

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

			await this.events.publish(
			{
				name: "game.phase_changed",
				roomId: request.roomId,
				payload:
				{
					gameId,
					phase: "CLUE_SUBMISSION",
					roundNumber: 1,
					phaseEndsAt: phaseEndsAt.toISOString(),
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

				// Information needed when the game ends
				winner: true,
				terminationReason: true,
				endedAt: true,

				players:
				{
					select:
					{
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
				id: true,
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
				votes:
				{
					where:
					{
						voterGamePlayerId: player.id,
					},
					select:
					{
						id: true,
					},
					take: 1,
				}
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

		// Build the frontend result only when the game has ended
		let finalResult: ClientGameResult | null = null;

		if (game.phase === "FINISHED")
		{
			const spy = game.players.find(p => p.role === "SPY");
			if (!spy || !game.winner || !game.endedAt)
			{
				throw new Error("INVALID_GAME_STATE");
			}

			finalResult = 
			{
				gameId : game.id,
				status: "FINISHED",
				winner: game.winner,
				reason: null,
				endedAt: game.endedAt.toISOString(),
				revelation:
				{
					spyUserId: spy.userId,
					secretWord: game.secretWord,
				},
			};
		}
		else if (game.phase === "TERMINATED")
		{
			if (!game.terminationReason || !game.endedAt)
			{
				throw new Error("INVALID_FINAL_STATE");
			}

			finalResult = 
			{
				gameId : game.id,
				status: "TERMINATED",
				winner: null,
				reason: game.terminationReason,
				endedAt: game.endedAt.toISOString(),
				revelation: null,
			};
		}

		// Build a safe response for this player
		const state: PlayerGameState =
		{
			gameId: game.id,
			phase: game.phase,
			roundNumber: game.currentRoundNumber,
			phaseEndsAt: game.phaseEndsAt?.toISOString() ?? null,
			players: game.players.map(p => (
			{
				userId: p.userId,
				participationStatus: p.participationStatus,
				connectionStatus: p.connectionStatus,
			})),
			role: player.role,
			clues,
			hasSubmittedClue: clues.some(c => c.userId === userId),
			hasSubmittedVote: round.votes.length > 0,
			finalResult,
		};

		// Only Detectives receive the secret word
		if (player.role === "DETECTIVE")
		{
			state.secretWord = game.secretWord;
		}

		return state;
	}

	async submitClue(gameId: string, userId: number, clue: string, nowMs?: number): Promise<AcceptedClue>
	{
		// Validate the clue before starting a transaction
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

		// Needed to distinguish duplicate clues from multiple submissions by the same player
		let roundId: number | null = null;
		let authorId: number | null = null;

		try
		{
			const saved = await retryOnTransactionConflict(() => this.prisma.$transaction(async tx =>
			{
				// Lock the game before checking its phase
				await lockGame(tx, gameId);

				// Capture server time AFTER acquiring the lock. nowMs is only for trusted tests/backend calls
				const submittedAtMs = nowMs ?? Date.now();
				if (!Number.isFinite(submittedAtMs) || Number.isNaN(new Date(submittedAtMs).getTime()))
				{
					throw new Error("INVALID_TIMESTAMP");
				}

				// Read the current game
				const game = await tx.game.findUnique(
				{
					where:
					{
						id: gameId,
					},
					select:
					{
						roomId: true,
						phase: true,
						currentRoundNumber: true,
						phaseEndsAt: true,
					},
				});

				if (!game)
				{
					throw new Error("GAME_NOT_FOUND");
				}

				if (game.phase !== "CLUE_SUBMISSION")
				{
					throw new Error("INVALID_PHASE");
				}

				if (game.phaseEndsAt === null || submittedAtMs >= game.phaseEndsAt.getTime())
				{
					throw new Error("PHASE_EXPIRED");
				}

				// Check the player
				const player = await tx.gamePlayer.findUnique(
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

				// Read the current round
				const round = await tx.gameRound.findUnique(
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

				roundId = round.id;
				authorId = player.id;

				// Save the clue inside the transaction
				await tx.clue.create(
				{
					data:
					{
						roundId: round.id,
						authorGamePlayerId: player.id,
						text: cleanClue,
						normalizedText: cleanClue.toLowerCase(),
						submittedAt: new Date(submittedAtMs),
					},
				});
				const acceptedClue: AcceptedClue =
				{
					gameId,
					roundNumber: game.currentRoundNumber,
					userId,
					clue: cleanClue,
				};

				return {
					roomId: game.roomId,
					acceptedClue,
				};
			},
			{
				isolationLevel: "Serializable"
			}),
			);

			// The transaction committed successfully. Only now publish the public clue event.
			await this.events.publish(
			{
				name: "game.clue_submitted",
				roomId: saved.roomId,
				payload: saved.acceptedClue,
			});
			return saved.acceptedClue;
		}
		catch (error)
		{
			if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002")
			{
				// A failed INSERT aborts the transaction. Check for the player's previous clue OUTSIDE it
				const previousClue = roundId !== null && authorId !== null ? await this.prisma.clue.findUnique(
				{
					where:
					{
						roundId_authorGamePlayerId:
						{
							roundId,
							authorGamePlayerId: authorId,
						},
					},
					select:
					{
						id: true,
					},
				}) : null;
				if (previousClue)
				{
					throw new Error("CLUE_ALREADY_SUBMITTED");
				}

				throw new Error("DUPLICATE_CLUE");
			}
			throw error;
		}
	}

	async submitVote(gameId: string, voterUserId: number, targetUserId: number, nowMs?: number): Promise<void>
	{
		if (typeof gameId !== "string" || gameId.trim() === "" || !Number.isSafeInteger(voterUserId) || voterUserId <= 0 || !Number.isSafeInteger(targetUserId) || targetUserId <= 0)
		{
			throw new Error("INVALID_VOTE_REQUEST");
		}
		try
		{
			await retryOnTransactionConflict(() => this.prisma.$transaction(async tx =>
			{
				// Lock the game
				await lockGame(tx, gameId);

				const submittedAtMs = nowMs ?? Date.now();

				if (!Number.isFinite(submittedAtMs) || Number.isNaN(new Date(submittedAtMs).getTime()))
				{
					throw new Error("INVALID_TIMESTAMP");
				}

				// Read the game AFTER acquiring the lock
				const game = await tx.game.findUnique(
				{
						where:
						{
							id: gameId
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
				if (game.phase !== "VOTING")
				{
					throw new Error("INVALID_PHASE");
				}
				if (game.phaseEndsAt === null || submittedAtMs >= game.phaseEndsAt.getTime())
				{
					throw new Error("PHASE_EXPIRED");
				}

				// Find the voter
				const voter = await tx.gamePlayer.findUnique(
				{
					where:
					{
						gameId_userId:
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
					}
				});

				if (!voter)
				{
					throw new Error("NOT_GAME_PARTICIPANT");
				}
				if (voter.participationStatus !== "ACTIVE" || voter.connectionStatus !== "CONNECTED")
				{
					throw new Error("VOTER_NOT_ELIGIBLE");
				}

				// Find the target in the same game
				const target = await tx.gamePlayer.findUnique(
				{
					where:
					{
						gameId_userId:
						{
							gameId,
							userId: targetUserId,
						},
					},
					select:
					{
						id: true,
						participationStatus: true,
					}
				});

				if (!target || target.participationStatus !== "ACTIVE")
				{
					throw new Error("INVALID_VOTE_TARGET");
				}

				// Self-voting is allowed

				// Find the current round
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
					throw new Error("ROUND_NOT_FOUND");
				}

				// Save the private vote
				await tx.vote.create(
				{
					data:
					{
						roundId: round.id,
						voterGamePlayerId: voter.id,
						targetGamePlayerId: target.id,
						submittedAt: new Date(submittedAtMs),
					}
				});
			},
			{
				isolationLevel: 'ReadCommitted'
			}));
		}
		catch (error)
		{
			if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002")
			{
				throw new Error("VOTE_ALREADY_SUBMITTED");
			}
			throw error;
		}
	}


	async resolveRound(gameId: string, nowMs: number = Date.now()): Promise<RoundResolutionResult>
	{
		const resolution = await retryOnTransactionConflict(() => this.prisma.$transaction(async tx =>
		{
			// Lock this game before reading its votes
			await lockGame(tx, gameId);

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
					roundId: round.id,
					voter:
					{
						is:
						{
							participationStatus: 'ACTIVE',
						}
					}
				},
				select:
				{
					targetGamePlayerId: true,
				},
			});

			// All ACTIVE players are voting candidates. A temporarily disconnected player can still receive votes
			const activePlayers = game.players.filter(player => player.participationStatus === 'ACTIVE');

			// Resolve voting BEFORE processing disconnections
			const result = calculateVotingOutcome(activePlayers, votes);
			const eliminated = result.eliminated;

			// Voting victory takes priority over departures
			let winner: GameFinalResult['winner'] = null;

			if (eliminated)
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

			// Remove the eliminated player from the remaining active-player count
			const remainingPlayers = activePlayers.filter(player => player.id !== eliminated?.id);

			// Departures are processed ONLY if voting did not already produce a winner
			const departed = winner === null ? remainingPlayers.filter(player => player.connectionStatus === 'DISCONNECTED') : [];

			const remainingConnected = remainingPlayers.filter(player => player.connectionStatus === 'CONNECTED');

			let reason: GameFinalResult['reason'] = null;

			if (winner === null)
			{
				if (departed.some(player => player.role === 'SPY'))
				{
					reason = 'SPY_DEPARTED';
				}
				else if (remainingConnected.length <= 2)
				{
					reason = 'INSUFFICIENT_PLAYERS';
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

			// Save permanent departures only when there was no winner
			if (departed.length > 0)
			{
				await tx.gamePlayer.updateMany(
				{
					where:
					{
						gameId,
						id:
						{
							in: departed.map(player => player.id)
						},
						participationStatus: 'ACTIVE',
						connectionStatus: 'DISCONNECTED',
					},
					data:
					{
						participationStatus: 'DEPARTED',
					}
				});
			}

			// Voting resolves before any remaining disconnections.
			if (result)
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
				roomId: game.roomId,
				roundNumber: game.currentRoundNumber,
				outcome: result?.outcome ?? null,
				eliminatedUserId: eliminated?.userId ?? null,
				eliminatedRole: eliminated?.role ?? null,
				departedUserIds: departed.map(player => player.userId),
				nextPhase,
				phaseEndsAt: nextDeadline?.toISOString() ?? null,
				finalResult,
			};
		},
		{
			isolationLevel: 'Serializable'
		}));

		// Notify permanently departed players
		for (const userId of resolution.departedUserIds)
		{
			await this.events.publish(
			{
				name: "game.player_updated",
				roomId: resolution.roomId,
				payload:
				{
					gameId,
					userId,
					participationStatus: "DEPARTED",
				},
			});
		}

		// Notify the eliminated player
		if (resolution.eliminatedUserId !== null)
		{
			await this.events.publish(
			{
				name: "game.player_updated",
				roomId: resolution.roomId,
				payload:
				{
					gameId,
					userId: resolution.eliminatedUserId,
					participationStatus: "ELIMINATED",
				},
			});
		}

		// Announce the round result
		if (resolution.outcome !== null)
		{
			await this.events.publish(
			{
				name: "game.round_resolved",
				roomId: resolution.roomId,
				payload:
				{
					gameId,
					roundNumber: resolution.roundNumber,
					outcome: resolution.outcome,
					eliminatedUserId: resolution.eliminatedUserId,
					eliminatedRole: resolution.eliminatedRole,
				},
			});
		}

		// Announce game completion or the next round
		if (resolution.finalResult !== null)
		{
			await this.events.publish(
			{
				name: "game.ended",
				roomId: resolution.roomId,
				payload: resolution.finalResult,
			});
		}
		else if (resolution.nextPhase === "CLUE_SUBMISSION" && resolution.phaseEndsAt !== null)
		{
			await this.events.publish(
			{
				name: "game.phase_changed",
				roomId: resolution.roomId,
				payload:
				{
					gameId,
					phase: "CLUE_SUBMISSION",
					roundNumber: resolution.roundNumber + 1,
					phaseEndsAt: resolution.phaseEndsAt,
				},
			});
		}

		// Return the result to caller
		return resolution;
	}

	private async updateConnectionStatus(gameId: string, userId: number, newStatus: "CONNECTED" | "DISCONNECTED", nowMs: number = Date.now()): Promise<void>
	{
		// Validate input
		if (typeof gameId !== "string" || gameId.trim() === "" || !Number.isSafeInteger(userId) || userId <= 0)
		{
			throw new Error("INVALID_PLAYER_REQUEST");
		}

		// Make the change in a database transaction
		const result = await this.prisma.$transaction(
			async tx =>
			{

				await lockGame(tx, gameId);

				const game = await tx.game.findUnique(
				{
					where:
					{
						id: gameId,
					},
					select:
					{
						roomId: true,
						phase: true,
						phaseEndsAt: true,
					},
				});

				if (!game)
				{
					throw new Error("GAME_NOT_FOUND");
				}

				if (game.phase === "FINISHED" || game.phase === "TERMINATED")
				{
					throw new Error("GAME_NOT_ACTIVE");
				}

				// Find this participant within this specific game
				const player = await tx.gamePlayer.findUnique(
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
						id: true,
						participationStatus: true,
						connectionStatus: true,
					},
				});

				if (!player)
				{
					throw new Error("NOT_GAME_PARTICIPANT");
				}

				// ELIMINATED or DEPARTED players cannot rejoin active gameplay
				if (player.participationStatus !== "ACTIVE")
				{
					throw new Error("PLAYER_NOT_ACTIVE");
				}

				// The round is closing. Don't apply a late connection update to an expired voting round
				if (game.phase === "VOTING" && (game.phaseEndsAt === null || nowMs >= game.phaseEndsAt.getTime()))
				{
					throw new Error("ROUND_CLOSING");
				}

				// Repeated updates are harmless
				if (player.connectionStatus === newStatus)
				{
					return {
						roomId: game.roomId,
						changed: false
					};
				}

				// Update only if the player still has the status we read earlier
				const updated = await tx.gamePlayer.updateMany(
				{
					where:
					{
						id: player.id,
						gameId,
						participationStatus: "ACTIVE",
						connectionStatus: player.connectionStatus,
					},
					data:
					{
						connectionStatus: newStatus,
					}
				});

				if (updated.count !== 1)
				{
					throw new Error("CONNECTION_STATE_CHANGED");
				}

				return {
					roomId: game.roomId,
					changed: true
				};
			},
			{
				isolationLevel: "Serializable",
			}
		);

		// Publish only AFTER the transaction commits
		if (result.changed)
		{
			await this.events.publish(
			{
				name: "game.player_updated",
				roomId: result.roomId,
				payload:
				{
					gameId,
					userId,
					connectionStatus: newStatus,
				},
			});
		}
	}

	// Called when a participant loses their connection
	async markDisconnected(gameId: string, userId: number, nowMs: number = Date.now()): Promise<void>
	{
		await this.updateConnectionStatus(gameId, userId, "DISCONNECTED", nowMs);
	}

	// Called when a participant reconnects
	async reconnectPlayer(gameId: string, userId: number, nowMs: number = Date.now())
	{
		await this.updateConnectionStatus(gameId, userId, "CONNECTED", nowMs);
		return this.getPlayerState(gameId, userId);
	}

	async leaveGame(gameId: string, userId: number, nowMs: number = Date.now()): Promise<LeaveGameResult>
	{
		// Validate input
		if (typeof gameId !== "string" || gameId.trim() === "" || !Number.isSafeInteger(userId) || userId <= 0 || !Number.isFinite(nowMs) || Number.isNaN(new Date(nowMs).getTime()))
		{
			throw new Error("INVALID_PLAYER_REQUEST");
		}

		// Save the departure and possible game termination together in a database transaction
		const result = await this.prisma.$transaction(async tx =>
		{

			await lockGame(tx, gameId);

			const game = await tx.game.findUnique(
			{
				where:
				{
					id: gameId,
				},
				select:
				{
					roomId: true,
					phase: true,
					players:
					{
						select:
						{
							id: true,
							userId: true,
							role: true,
							participationStatus: true,
						},
					},
				},
			});

			if (!game)
			{
				throw new Error("GAME_NOT_FOUND");
			}

			// Find the leaving player in this game
			const player = game.players.find(participant => participant.userId === userId);

			if (!player)
			{
				throw new Error("NOT_GAME_PARTICIPANT");
			}

			// Repeated departure requests are harmless, even if the first departure ended the game.
			if (player.participationStatus === "DEPARTED")
			{
				return {
					gameId,
					roomId: game.roomId,
					departedUserId: userId,
					changed: false,
					finalResult: null,
				};
			}

			// Don't modify completed games
			if (game.phase === "FINISHED" || game.phase === "TERMINATED")
			{
				throw new Error("GAME_NOT_ACTIVE");
			}

			if (player.participationStatus !== "ACTIVE")
			{
				throw new Error("PLAYER_NOT_ACTIVE");
			}

			// Mark the player as permanently departed
			const updatedPlayer = await tx.gamePlayer.updateMany(
			{
				where:
				{
					id: player.id,
					gameId,
					participationStatus: "ACTIVE",
				},
				data:
				{
					participationStatus: "DEPARTED",
				},
			});

			if (updatedPlayer.count !== 1)
			{
				throw new Error("PLAYER_STATE_CHANGED");
			}

			// Count the players remaining after departure. Temporarily disconnected players are still ACTIVE until round resolution
			const remainingPlayers = game.players.filter(participant => participant.participationStatus === "ACTIVE" && participant.id !== player.id);

			// Decide whether the game must terminate
			let reason: GameFinalResult['reason'] = null;

			if (player.role === "SPY")
			{
				reason = "SPY_DEPARTED";
			}
			else if (remainingPlayers.length <= 2)
			{
				reason = "INSUFFICIENT_PLAYERS";
			}

			let finalResult: GameFinalResult | null = null;

			// Terminate immediately, if required
			if (reason !== null)
			{
				const endedAt = new Date(nowMs);

				const updatedGame = await tx.game.updateMany(
				{
					where:
					{
						id: gameId,
						phase: game.phase,
					},
					data:
					{
						phase: "TERMINATED",
						winner: null,
						terminationReason: reason,
						phaseEndsAt: null,
						endedAt,
					},
				});

				if (updatedGame.count !== 1)
				{
					throw new Error("GAME_STATE_CHANGED");
				}

				finalResult =
				{
					gameId,
					roomId: game.roomId,
					status: "TERMINATED",
					winner: null,
					reason,
					endedAt: endedAt.toISOString(),
				};
			}

			// Return the committed result
			return {
				gameId,
				roomId: game.roomId,
				departedUserId: userId,
				changed: true,
				finalResult,
			};
		},
		{
			isolationLevel: "Serializable"
		});

		// Repeated requests don't produce duplicate events
		if (!result.changed)
		{
			return result;
		}

		// Announce permanent departure
		await this.events.publish(
		{
			name: "game.player_updated",
			roomId: result.roomId,
			payload:
			{
				gameId,
				userId,
				participationStatus: "DEPARTED",
			},
		});

		// Announce game termination if it occurred
		if (result.finalResult !== null)
		{
			await this.events.publish(
			{
				name: "game.ended",
				roomId: result.roomId,
				payload: result.finalResult,
			});
		}

		return result;
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
				roomId: true,
				currentRoundNumber: true,
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

		const nextDeadline = new Date(deadlineMs + durationMs);

		const updated = await this.prisma.game.updateMany(
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
				phaseEndsAt: nextDeadline,
			},
		});

		if (updated.count !== 1)
		{
			return false;
		}

		// The phase changed successfully in PostgreSQL.
		await this.events.publish(
		{
			name: "game.phase_changed",
			roomId: game.roomId,
			payload:
			{
				gameId,
				phase: nextPhase,
				roundNumber: game.currentRoundNumber,
				phaseEndsAt: nextDeadline.toISOString(),
			},
		});

		return true;
	}
}

