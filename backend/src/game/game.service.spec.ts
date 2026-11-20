
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameService } from './game.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('GameService', () => {
  let service: GameService;

  // Fake Prisma database for unit tests
  const prismaMock = {
    game: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },

    gamePlayer: {
      findUnique: vi.fn(),
    },

    gameRound: {
      findUnique: vi.fn(),
    },

    clue: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },

    vote: {
      create: vi.fn(),
    },

    $transaction: vi.fn(),
  };

  const txMock = {
    game: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },

    gameRound: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },

    gamePlayer: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },

    vote: {
      findMany: vi.fn(),
    },
  };


  const dbDeadline = new Date('2030-01-01T12:00:00.000Z');

  // Prepare a valid game, player and round for clue tests
  function mockClueDatabase() {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    });

    prismaMock.gameRound.findUnique.mockResolvedValueOnce({
      id: 88,
    });

    prismaMock.clue.create.mockResolvedValueOnce({});
  }


  function mockVotingDatabase(targetPlayerId = 88) {
    // Game is currently in the voting phase
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'VOTING',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    // Voter
    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    });

    // Target
    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: targetPlayerId,
      participationStatus: 'ACTIVE',
    });

    // Current round
    prismaMock.gameRound.findUnique.mockResolvedValueOnce({
      id: 99,
    });

    // Successful database insertion
    prismaMock.vote.create.mockResolvedValueOnce({});
  }


  const players3 = [
    {
      id: 11,
      userId: 1,
      role: 'SPY',
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    },
    {
      id: 12,
      userId: 2,
      role: 'DETECTIVE',
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    },
    {
      id: 13,
      userId: 3,
      role: 'DETECTIVE',
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    },
  ];

  function mockRoundResolution(
    voteTargets: number[],
    players = players3,
  ) {
    const gameId = randomUUID();
    const roomId = randomUUID();

    txMock.game.findUnique.mockResolvedValueOnce({
      roomId,
      phase: 'VOTING',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
      players,
    });

    txMock.gameRound.findUnique.mockResolvedValueOnce({
      id: 101,
    });

    txMock.vote.findMany.mockResolvedValueOnce(
      voteTargets.map(targetGamePlayerId => ({
        targetGamePlayerId,
      }))
    );

    txMock.game.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    txMock.gamePlayer.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    txMock.gamePlayer.update.mockResolvedValueOnce({});
    txMock.gameRound.update.mockResolvedValueOnce({});
    txMock.gameRound.create.mockResolvedValueOnce({});

    return { gameId, roomId };
  }


  beforeEach(async () => {
    // Reset mock state before every test
    prismaMock.game.findUnique.mockReset();
    prismaMock.game.create.mockReset();
    prismaMock.game.updateMany.mockReset();

    prismaMock.gamePlayer.findUnique.mockReset();
    prismaMock.gameRound.findUnique.mockReset();

    prismaMock.clue.create.mockReset();
    prismaMock.clue.findUnique.mockReset();

    // Default database responses
    prismaMock.game.findUnique.mockResolvedValue(null);
    prismaMock.game.create.mockResolvedValue({});

    prismaMock.vote.create.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = moduleRef.get<GameService>(GameService);

    prismaMock.$transaction.mockReset();

    txMock.game.findUnique.mockReset();
    txMock.game.updateMany.mockReset();

    txMock.gameRound.findUnique.mockReset();
    txMock.gameRound.update.mockReset();
    txMock.gameRound.create.mockReset();

    txMock.gamePlayer.updateMany.mockReset();
    txMock.gamePlayer.update.mockReset();

    txMock.vote.findMany.mockReset();

    // Execute transactions against the fake transaction client.
    prismaMock.$transaction.mockImplementation(
      async (
        operation: (tx: typeof txMock) => Promise<unknown>
      ) => operation(txMock)
    );
  });

  // ==========================================
  // 1. GAME INITIALIZATION
  // ==========================================

  it('starts a game with 3 players', async () => {
    const roomId = randomUUID();

    const result = await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });

    expect(result.gameId).toEqual(expect.any(String));
    expect(result.roomId).toBe(roomId);
    expect(result.phase).toBe('CLUE_SUBMISSION');
    expect(result.roundNumber).toBe(1);

    expect(
      Number.isFinite(Date.parse(result.phaseEndsAt))
    ).toBe(true);

    // Public response must not expose private information
    expect(result).not.toHaveProperty('secretWord');
    expect(result).not.toHaveProperty('players');
  });

  it('rejects fewer than 3 players', async () => {
    await expect(
      service.startGame({
        roomId: randomUUID(),
        participantIds: [1, 2],
      })
    ).rejects.toThrow('INVALID_PLAYER_COUNT');

    expect(prismaMock.game.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate player IDs', async () => {
    await expect(
      service.startGame({
        roomId: randomUUID(),
        participantIds: [1, 2, 2],
      })
    ).rejects.toThrow('DUPLICATE_PLAYERS');

    expect(prismaMock.game.create).not.toHaveBeenCalled();
  });

  it('prevents starting twice in the same room', async () => {
    const roomId = randomUUID();

    const firstGame = await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });

    // Simulate an existing game in PostgreSQL
    prismaMock.game.findUnique.mockResolvedValueOnce({
      id: firstGame.gameId,
    });

    await expect(
      service.startGame({
        roomId,
        participantIds: [1, 2, 3],
      })
    ).rejects.toThrow('GAME_ALREADY_ACTIVE');

    expect(prismaMock.game.create).toHaveBeenCalledTimes(1);
  });

  it('assigns exactly one Spy and hides the secret word', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    expect(prismaMock.game.create).toHaveBeenCalledTimes(1);

    // Inspect the players passed to Prisma
    const createArgs = (
      prismaMock.game.create.mock.calls[0] as unknown[]
    )[0] as {
      data: {
        players: {
          create: Array<{ role: string }>;
        };
      };
    };

    const roles = createArgs.data.players.create.map(
      player => player.role
    );

    expect(roles).toHaveLength(3);

    expect(
      roles.filter(role => role === 'SPY')
    ).toHaveLength(1);

    expect(
      roles.filter(role => role === 'DETECTIVE')
    ).toHaveLength(2);

    expect(result).not.toHaveProperty('secretWord');
    expect(result).not.toHaveProperty('players');
  });

  it('creates the game, players and first round in Prisma', async () => {
    const roomId = randomUUID();

    const result = await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });

    expect(prismaMock.game.create).toHaveBeenCalledTimes(1);

    expect(prismaMock.game.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: result.gameId,
        phase: 'CLUE_SUBMISSION',
        currentRoundNumber: 1,

        secretWord: expect.any(String),
        phaseEndsAt: expect.any(Date),
        startedAt: expect.any(Date),

        room: {
          connect: { id: roomId },
        },

        rounds: {
          create: { number: 1 },
        },

        players: {
          create: expect.arrayContaining([
            expect.objectContaining({
              participationStatus: 'ACTIVE',
              connectionStatus: 'CONNECTED',
            }),
          ]),
        },
      }),
    });
  });

  // ==========================================
  // 2. PRIVATE PLAYER STATE
  // ==========================================

  it('returns Detective state with the secret word', async () => {
    const gameId = randomUUID();

    prismaMock.game.findUnique.mockResolvedValueOnce({
      id: gameId,
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
      secretWord: 'ocean',
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      role: 'DETECTIVE',
    });

    prismaMock.gameRound.findUnique.mockResolvedValueOnce({
      clues: [
        {
          text: 'water',
          author: { userId: 1 },
        },
      ],
    });

    const state = await service.getPlayerState(gameId, 1);

    expect(state.gameId).toBe(gameId);
    expect(state.role).toBe('DETECTIVE');
    expect(state.secretWord).toBe('ocean');
    expect(state.phase).toBe('CLUE_SUBMISSION');

    expect(state.clues).toHaveLength(1);
    expect(state.clues[0].clue).toBe('water');
    expect(state.hasSubmittedClue).toBe(true);

    expect(state.phaseEndsAt).toBe(
      dbDeadline.toISOString()
    );
  });

  it('never exposes the secret word to the Spy', async () => {
    const gameId = randomUUID();

    prismaMock.game.findUnique.mockResolvedValueOnce({
      id: gameId,
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
      secretWord: 'ocean',
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      role: 'SPY',
    });

    prismaMock.gameRound.findUnique.mockResolvedValueOnce({
      clues: [],
    });

    const state = await service.getPlayerState(gameId, 2);

    expect(state.role).toBe('SPY');
    expect(state).not.toHaveProperty('secretWord');
    expect(state.hasSubmittedClue).toBe(false);
    expect(state.clues).toHaveLength(0);
  });

  it('rejects nonparticipants before reading clues', async () => {
    const gameId = randomUUID();

    prismaMock.game.findUnique.mockResolvedValueOnce({
      id: gameId,
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
      secretWord: 'ocean',
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.getPlayerState(gameId, 99)
    ).rejects.toThrow('NOT_GAME_PARTICIPANT');

    expect(
      prismaMock.gameRound.findUnique
    ).not.toHaveBeenCalled();
  });

  it('rejects an unknown game', async () => {
    await expect(
      service.getPlayerState(randomUUID(), 1)
    ).rejects.toThrow('GAME_NOT_FOUND');
  });

  // ==========================================
  // 3. CLUE SUBMISSION
  // ==========================================

  it('saves a valid clue and trims spaces', async () => {
    mockClueDatabase();

    const gameId = randomUUID();
    const time = dbDeadline.getTime() - 1000;

    const result = await service.submitClue(
      gameId,
      1,
      '  Water  ',
      time
    );

    expect(result.gameId).toBe(gameId);
    expect(result.userId).toBe(1);
    expect(result.roundNumber).toBe(1);
    expect(result.clue).toBe('Water');

    expect(prismaMock.clue.create).toHaveBeenCalledWith({
      data: {
        roundId: 88,
        authorGamePlayerId: 77,
        text: 'Water',
        normalizedText: 'water',
        submittedAt: new Date(time),
      },
    });
  });

  it('rejects a second clue from the same player', async () => {
    mockClueDatabase();

    prismaMock.clue.create.mockReset();
    prismaMock.clue.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    prismaMock.clue.findUnique.mockResolvedValueOnce({
      id: 100,
    });

    await expect(
      service.submitClue(
        randomUUID(),
        1,
        'Beach',
        dbDeadline.getTime() - 1000
      )
    ).rejects.toThrow('CLUE_ALREADY_SUBMITTED');
  });

  it('rejects duplicate clues ignoring capitalization', async () => {
    mockClueDatabase();

    prismaMock.clue.create.mockReset();
    prismaMock.clue.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    // No previous clue from this author:
    // the unique constraint was the normalized clue text.
    prismaMock.clue.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submitClue(
        randomUUID(),
        2,
        'WATER',
        dbDeadline.getTime() - 1000
      )
    ).rejects.toThrow('DUPLICATE_CLUE');
  });

  it('rejects clues at or after the deadline', async () => {
    mockClueDatabase();

    await expect(
      service.submitClue(
        randomUUID(),
        1,
        'Water',
        dbDeadline.getTime()
      )
    ).rejects.toThrow('PHASE_EXPIRED');

    expect(prismaMock.clue.create).not.toHaveBeenCalled();
  });

  it('rejects empty and oversized clues', async () => {
    const gameId = randomUUID();
    const time = dbDeadline.getTime() - 1000;

    mockClueDatabase();

    await expect(
      service.submitClue(gameId, 1, '   ', time)
    ).rejects.toThrow('EMPTY_CLUE');

    mockClueDatabase();

    await expect(
      service.submitClue(
        gameId,
        1,
        'a'.repeat(101),
        time
      )
    ).rejects.toThrow('CLUE_TOO_LONG');

    expect(prismaMock.clue.create).not.toHaveBeenCalled();
  });

  it('rejects clues from nonparticipants', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submitClue(
        randomUUID(),
        99,
        'Water',
        dbDeadline.getTime() - 1000
      )
    ).rejects.toThrow('NOT_GAME_PARTICIPANT');

    expect(prismaMock.clue.create).not.toHaveBeenCalled();
  });

  it('rejects clues outside clue submission', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'DISCUSSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    });

    await expect(
      service.submitClue(
        randomUUID(),
        1,
        'Water',
        dbDeadline.getTime() - 1000
      )
    ).rejects.toThrow('INVALID_PHASE');

    expect(prismaMock.clue.create).not.toHaveBeenCalled();
  });

  // ==========================================
  // 4. GAME PHASE TRANSITIONS
  // ==========================================

  it('moves from clues to discussion', async () => {
    const gameId = randomUUID();

    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'CLUE_SUBMISSION',
      phaseEndsAt: dbDeadline,
    });

    prismaMock.game.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const changed = await service.advancePhaseIfExpired(
      gameId,
      dbDeadline.getTime()
    );

    expect(changed).toBe(true);

    expect(prismaMock.game.updateMany).toHaveBeenCalledWith({
      where: {
        id: gameId,
        phase: 'CLUE_SUBMISSION',
        phaseEndsAt: dbDeadline,
      },
      data: {
        phase: 'DISCUSSION',
        phaseEndsAt: new Date(
          dbDeadline.getTime() + 120_000
        ),
      },
    });
  });

  it('moves from discussion to voting', async () => {
    const gameId = randomUUID();

    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'DISCUSSION',
      phaseEndsAt: dbDeadline,
    });

    prismaMock.game.updateMany.mockResolvedValueOnce({
      count: 1,
    });

    const changed = await service.advancePhaseIfExpired(
      gameId,
      dbDeadline.getTime()
    );

    expect(changed).toBe(true);

    expect(prismaMock.game.updateMany).toHaveBeenCalledWith({
      where: {
        id: gameId,
        phase: 'DISCUSSION',
        phaseEndsAt: dbDeadline,
      },
      data: {
        phase: 'VOTING',
        phaseEndsAt: new Date(
          dbDeadline.getTime() + 30_000
        ),
      },
    });
  });

  it('does not advance before the deadline', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'CLUE_SUBMISSION',
      phaseEndsAt: dbDeadline,
    });

    const changed = await service.advancePhaseIfExpired(
      randomUUID(),
      dbDeadline.getTime() - 1
    );

    expect(changed).toBe(false);

    expect(prismaMock.game.updateMany).not.toHaveBeenCalled();
  });

  
  it('resolves voting when its deadline expires', async () => {
    const { gameId } = mockRoundResolution([11, 11, 12]);

    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'VOTING',
      phaseEndsAt: dbDeadline,
    });

    const changed = await service.advancePhaseIfExpired(
      gameId,
      dbDeadline.getTime()
    );

    expect(changed).toBe(true);
    expect(txMock.gameRound.update).toHaveBeenCalledTimes(1);
  });



  // ==========================================
  // 5. PRIVATE VOTING
  // ==========================================

  it('accepts a valid private vote', async () => {
    mockVotingDatabase();

    const gameId = randomUUID();
    const time = dbDeadline.getTime() - 1000;

    const result = await service.submitVote(
      gameId, 1, 2, time
    );

    expect(result).toBeUndefined();

    expect(prismaMock.vote.create).toHaveBeenCalledWith({
      data: {
        roundId: 99,
        voterGamePlayerId: 77,
        targetGamePlayerId: 88,
        submittedAt: new Date(time),
      },
    });
  });

  it('allows self-voting', async () => {
    // The voter and target have the same GamePlayer ID.
    mockVotingDatabase(77);

    await service.submitVote(
      randomUUID(),
      1,
      1,
      dbDeadline.getTime() - 1000,
    );

    expect(prismaMock.vote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voterGamePlayerId: 77,
        targetGamePlayerId: 77,
      }),
    });
  });

  it('rejects a second vote in the same round', async () => {
    mockVotingDatabase();

    prismaMock.vote.create.mockReset();
    prismaMock.vote.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('VOTE_ALREADY_SUBMITTED');
  });

  it('rejects voting outside the VOTING phase', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'DISCUSSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('INVALID_PHASE');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects votes at the deadline', async () => {
    mockVotingDatabase();

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime(),
      )
    ).rejects.toThrow('PHASE_EXPIRED');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects a voter outside the game', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      phase: 'VOTING',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submitVote(
        randomUUID(),
        99,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('NOT_GAME_PARTICIPANT');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects a disconnected voter', async () => {
    mockVotingDatabase();

    // Replace the voter with a disconnected player.
    prismaMock.gamePlayer.findUnique.mockReset();

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'DISCONNECTED',
    });

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('VOTER_NOT_ELIGIBLE');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects an eliminated voter', async () => {
    mockVotingDatabase();

    prismaMock.gamePlayer.findUnique.mockReset();

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ELIMINATED',
      connectionStatus: 'CONNECTED',
    });

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('VOTER_NOT_ELIGIBLE');
  });

  it('rejects a target outside the game', async () => {
    mockVotingDatabase();

    // The voter exists, but the target doesn't.
    prismaMock.gamePlayer.findUnique.mockReset();

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        99,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('INVALID_VOTE_TARGET');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects an eliminated target', async () => {
    mockVotingDatabase();

    prismaMock.gamePlayer.findUnique.mockReset();

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: 'CONNECTED',
    });

    prismaMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 88,
      participationStatus: 'ELIMINATED',
    });

    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
        dbDeadline.getTime() - 1000,
      )
    ).rejects.toThrow('INVALID_VOTE_TARGET');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });

  it('rejects voting in an unknown game', async () => {
    await expect(
      service.submitVote(
        randomUUID(),
        1,
        2,
      )
    ).rejects.toThrow('GAME_NOT_FOUND');

    expect(prismaMock.vote.create).not.toHaveBeenCalled();
  });


// ==========================================
// 6. ROUND RESOLUTION AND VICTORY
// ==========================================

  it('Detectives win when the Spy is eliminated', async () => {
    const { gameId, roomId } =
      mockRoundResolution([11, 11, 12]);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.outcome).toBe('ELIMINATED');
    expect(result.eliminatedUserId).toBe(1);
    expect(result.eliminatedRole).toBe('SPY');
    expect(result.nextPhase).toBe('FINISHED');

    expect(result.finalResult).toEqual({
      gameId,
      roomId,
      status: 'FINISHED',
      winner: 'DETECTIVES',
      reason: null,
      endedAt: dbDeadline.toISOString(),
    });

    expect(txMock.gamePlayer.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        participationStatus: 'ELIMINATED',
      },
    });

    expect(txMock.gameRound.create).not.toHaveBeenCalled();
  });

  it('Spy wins when Detective elimination leaves two players', async () => {
    const { gameId } =
      mockRoundResolution([12, 12, 11]);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.eliminatedUserId).toBe(2);
    expect(result.eliminatedRole).toBe('DETECTIVE');
    expect(result.nextPhase).toBe('FINISHED');
    expect(result.finalResult?.winner).toBe('SPY');
  });

  it('continues after Detective elimination with four players', async () => {
    const players4 = [
      ...players3,
      {
        id: 14,
        userId: 4,
        role: 'DETECTIVE',
        participationStatus: 'ACTIVE',
        connectionStatus: 'CONNECTED',
      },
    ];

    const { gameId } =
      mockRoundResolution([12, 12, 11, 13], players4);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.outcome).toBe('ELIMINATED');
    expect(result.eliminatedUserId).toBe(2);
    expect(result.nextPhase).toBe('CLUE_SUBMISSION');
    expect(result.finalResult).toBeNull();

    expect(txMock.gameRound.create).toHaveBeenCalledWith({
      data: {
        gameId,
        number: 2,
      },
    });
  });

  it('handles a tie without eliminating anyone', async () => {
    const { gameId } =
      mockRoundResolution([11, 12, 13]);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.outcome).toBe('TIE');
    expect(result.eliminatedUserId).toBeNull();
    expect(result.nextPhase).toBe('CLUE_SUBMISSION');

    expect(txMock.gamePlayer.update).not.toHaveBeenCalled();
    expect(txMock.gameRound.create).toHaveBeenCalled();
  });

  it('handles a round with no votes', async () => {
    const { gameId } = mockRoundResolution([]);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.outcome).toBe('NO_VOTES');
    expect(result.eliminatedUserId).toBeNull();
    expect(result.nextPhase).toBe('CLUE_SUBMISSION');
    expect(result.finalResult).toBeNull();
  });

  it('terminates with no winner if the Spy departed', async () => {
    const disconnectedPlayers = players3.map(player =>
      player.role === 'SPY'
        ? { ...player, connectionStatus: 'DISCONNECTED' }
        : player
    );

    const { gameId } =
      mockRoundResolution([11, 11], disconnectedPlayers);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.nextPhase).toBe('TERMINATED');
    expect(result.outcome).toBeNull();
    expect(result.finalResult?.winner).toBeNull();
    expect(result.finalResult?.reason).toBe('SPY_DEPARTED');

    expect(txMock.gamePlayer.updateMany).toHaveBeenCalled();
    expect(txMock.gameRound.update).not.toHaveBeenCalled();
  });

  it('terminates if departures leave fewer than three players', async () => {
    const disconnectedPlayers = players3.map(player =>
      player.id === 12
        ? { ...player, connectionStatus: 'DISCONNECTED' }
        : player
    );

    const { gameId } =
      mockRoundResolution([], disconnectedPlayers);

    const result = await service.resolveRound(
      gameId,
      dbDeadline.getTime()
    );

    expect(result.nextPhase).toBe('TERMINATED');
    expect(result.finalResult?.winner).toBeNull();
    expect(result.finalResult?.reason).toBe(
      'INSUFFICIENT_PLAYERS'
    );
  });

  it('rejects resolution before the voting deadline', async () => {
    const { gameId } =
      mockRoundResolution([11, 11, 12]);

    await expect(
      service.resolveRound(
        gameId,
        dbDeadline.getTime() - 1
      )
    ).rejects.toThrow('PHASE_NOT_EXPIRED');

    expect(txMock.game.updateMany).not.toHaveBeenCalled();
  });

  it('rejects resolution when the phase changed concurrently', async () => {
    const { gameId } =
      mockRoundResolution([11, 11, 12]);

    txMock.game.updateMany.mockReset();
    txMock.game.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      service.resolveRound(
        gameId,
        dbDeadline.getTime()
      )
    ).rejects.toThrow('ROUND_ALREADY_RESOLVED');

    expect(txMock.gameRound.update).not.toHaveBeenCalled();
    expect(txMock.gamePlayer.update).not.toHaveBeenCalled();
  });


});
