
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameService } from './game.service.js';
import { GameEventsService } from './game-events.service.js';
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
      findFirst: vi.fn(),
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
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    clue: {
      create: vi.fn(),
    },
    vote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
  const eventsMock = {
    publish: vi.fn(),
  };
  const dbDeadline = new Date('2030-01-01T12:00:00.000Z');
  // Prepare a valid game, player and round for clue tests
  function mockClueDatabase(roomId = randomUUID()) {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      roomId,
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
  function mockConnectionDatabase(
    currentStatus: 'CONNECTED' | 'DISCONNECTED',
    phase: 'DISCUSSION' | 'VOTING' = 'DISCUSSION',
  ) {
    const roomId = randomUUID();
    txMock.game.findUnique.mockResolvedValueOnce({
      roomId,
      phase,
      phaseEndsAt: dbDeadline,
    });
    txMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'ACTIVE',
      connectionStatus: currentStatus,
    });
    txMock.gamePlayer.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    return roomId;
  }
  beforeEach(async () => {
    // 1. Reset regular Prisma mocks.
    prismaMock.game.findUnique.mockReset();
    prismaMock.game.create.mockReset();
    prismaMock.game.updateMany.mockReset();
    prismaMock.gamePlayer.findUnique.mockReset();
    prismaMock.gameRound.findUnique.mockReset();
    prismaMock.clue.create.mockReset();
    prismaMock.clue.findUnique.mockReset();
    prismaMock.clue.findFirst.mockReset();
    prismaMock.vote.create.mockReset();
    prismaMock.$transaction.mockReset();

    // 2. Reset transaction-client mocks.
    txMock.game.findUnique.mockReset();
    txMock.game.updateMany.mockReset();
    txMock.gameRound.findUnique.mockReset();
    txMock.gameRound.update.mockReset();
    txMock.gameRound.create.mockReset();
    txMock.gamePlayer.findUnique.mockReset();
    txMock.gamePlayer.updateMany.mockReset();
    txMock.gamePlayer.update.mockReset();
    txMock.clue.create.mockReset();
    txMock.vote.findMany.mockReset();
    txMock.vote.create.mockReset();
    txMock.$queryRaw.mockReset();

    eventsMock.publish.mockReset();

    // 3. Configure default responses AFTER resets.
    prismaMock.game.findUnique.mockResolvedValue(null);
    prismaMock.game.create.mockResolvedValue({});
    eventsMock.publish.mockResolvedValue(undefined);
    txMock.$queryRaw.mockResolvedValue([]); // PostgreSQL game row lock

    // Older duplicate-clue tests mock findUnique; production may use
    // findFirst to check the author after a P2002 constraint error.
    prismaMock.clue.findFirst.mockImplementation(
      (...args) => prismaMock.clue.findUnique(...args),
    );

    // 4. Forward queries/writes inside the transaction to the existing
    // Prisma mocks. Individual txMock.mockResolvedValueOnce(...) values
    // for round-resolution and connection tests still override these.
    txMock.game.findUnique.mockImplementation(
      (...args) => prismaMock.game.findUnique(...args),
    );
    txMock.gamePlayer.findUnique.mockImplementation(
      (...args) => prismaMock.gamePlayer.findUnique(...args),
    );
    txMock.gameRound.findUnique.mockImplementation(
      (...args) => prismaMock.gameRound.findUnique(...args),
    );
    txMock.clue.create.mockImplementation(
      (...args) => prismaMock.clue.create(...args),
    );
    txMock.vote.create.mockImplementation(
      (...args) => prismaMock.vote.create(...args),
    );

    // 5. Execute callback-style Prisma transactions using txMock.
    prismaMock.$transaction.mockImplementation(
      async (operation: (tx: typeof txMock) => Promise<unknown>) =>
        operation(txMock),
    );

    // 6. Instantiate the actual service with the mocks.
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GameEventsService, useValue: eventsMock },
      ],
    }).compile();

    service = moduleRef.get<GameService>(GameService);
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

  it('publishes the first phase after game creation', async () => {
    const roomId = randomUUID();
    const result = await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.phase_changed',
      roomId,
      payload: {
        gameId: result.gameId,
        phase: 'CLUE_SUBMISSION',
        roundNumber: 1,
        phaseEndsAt: result.phaseEndsAt,
      },
    });
  });

  it('publishes accepted clues without revealing the word', async () => {
    const roomId = randomUUID();
    const gameId = randomUUID();
    mockClueDatabase(roomId);
    await service.submitClue(
      gameId,
      1,
      '  Beach  ',
      dbDeadline.getTime() - 1000,
    );
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.clue_submitted',
      roomId,
      payload: {
        gameId,
        roundNumber: 1,
        userId: 1,
        clue: 'Beach',
      },
    });
    const event = eventsMock.publish.mock.calls[0][0];
    expect(event.payload).not.toHaveProperty('secretWord');
  });

  it('does not publish a phase change when update fails', async () => {
    prismaMock.game.findUnique.mockResolvedValueOnce({
      roomId: randomUUID(),
      phase: 'CLUE_SUBMISSION',
      currentRoundNumber: 1,
      phaseEndsAt: dbDeadline,
    });
    prismaMock.game.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    const changed = await service.advancePhaseIfExpired(
      randomUUID(),
      dbDeadline.getTime(),
    );
    expect(changed).toBe(false);
    expect(eventsMock.publish).not.toHaveBeenCalled();
  });

  it('publishes round resolution and the final result', async () => {
    const { gameId, roomId } =
      mockRoundResolution([11, 11, 12]);
    await service.resolveRound(
      gameId,
      dbDeadline.getTime(),
    );
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.round_resolved',
      roomId,
      payload: {
        gameId,
        roundNumber: 1,
        outcome: 'ELIMINATED',
        eliminatedUserId: 1,
        eliminatedRole: 'SPY',
      },
    });
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.ended',
      roomId,
      payload: {
        gameId,
        roomId,
        status: 'FINISHED',
        winner: 'DETECTIVES',
        reason: null,
        endedAt: dbDeadline.toISOString(),
      },
    });
  });

  // ==========================================
  // 7. CONNECTION MANAGEMENT

  // ==========================================

  it('marks an active player as disconnected', async () => {
    const gameId = randomUUID();
    const roomId = mockConnectionDatabase('CONNECTED');
    await service.markDisconnected(gameId, 1);
    expect(txMock.gamePlayer.updateMany).toHaveBeenCalledWith({
      where: {
        id: 77,
        gameId,
        participationStatus: 'ACTIVE',
        connectionStatus: 'CONNECTED',
      },
      data: {
        connectionStatus: 'DISCONNECTED',
      },
    });
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.player_updated',
      roomId,
      payload: {
        gameId,
        userId: 1,
        connectionStatus: 'DISCONNECTED',
      },
    });
    expect(eventsMock.publish).toHaveBeenCalledTimes(1);
  });

  it('reconnects a player and restores their private state', async () => {
    const gameId = randomUUID();
    const roomId = mockConnectionDatabase('DISCONNECTED');
    // The existing getPlayerState() is tested separately.
    const privateState = {
      gameId,
      role: 'DETECTIVE',
      secretWord: 'Ocean',
    } as Awaited<ReturnType<GameService['getPlayerState']>>;
    const stateMethod = vi.spyOn(service, 'getPlayerState')
      .mockResolvedValueOnce(privateState);
    const result = await service.reconnectPlayer(gameId, 1);
    expect(stateMethod).toHaveBeenCalledWith(gameId, 1);
    expect(result).toEqual(privateState);
    expect(eventsMock.publish).toHaveBeenCalledWith({
      name: 'game.player_updated',
      roomId,
      payload: {
        gameId,
        userId: 1,
        connectionStatus: 'CONNECTED',
      },
    });
    // The public event does not reveal the secret word.
    expect(eventsMock.publish.mock.calls[0][0].payload)
      .not.toHaveProperty('secretWord');
  });

  it('does not publish duplicate disconnection events', async () => {
    mockConnectionDatabase('DISCONNECTED');
    await service.markDisconnected(randomUUID(), 1);
    expect(txMock.gamePlayer.updateMany)
      .not.toHaveBeenCalled();
    expect(eventsMock.publish).not.toHaveBeenCalled();
  });

  it('rejects a player who does not belong to the game', async () => {
    mockConnectionDatabase('CONNECTED');
    txMock.gamePlayer.findUnique.mockReset();
    txMock.gamePlayer.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.markDisconnected(randomUUID(), 99)
    ).rejects.toThrow('NOT_GAME_PARTICIPANT');
    expect(eventsMock.publish).not.toHaveBeenCalled();
  });

  it('rejects reconnection after permanent departure', async () => {
    mockConnectionDatabase('DISCONNECTED');
    txMock.gamePlayer.findUnique.mockReset();
    txMock.gamePlayer.findUnique.mockResolvedValueOnce({
      id: 77,
      participationStatus: 'DEPARTED',
      connectionStatus: 'DISCONNECTED',
    });
    await expect(
      service.reconnectPlayer(randomUUID(), 1)
    ).rejects.toThrow('PLAYER_NOT_ACTIVE');
    expect(txMock.gamePlayer.updateMany)
      .not.toHaveBeenCalled();
  });

  it('rejects reconnection after the voting deadline', async () => {
    mockConnectionDatabase('DISCONNECTED', 'VOTING');
    await expect(
      service.reconnectPlayer(
        randomUUID(),
        1,
        dbDeadline.getTime(),
      )
    ).rejects.toThrow('ROUND_CLOSING');
    expect(txMock.gamePlayer.updateMany)
      .not.toHaveBeenCalled();
  });

  it('rejects connection changes after the game ends', async () => {
    txMock.game.findUnique.mockResolvedValueOnce({
      roomId: randomUUID(),
      phase: 'FINISHED',
      phaseEndsAt: null,
    });
    await expect(
      service.markDisconnected(randomUUID(), 1)
    ).rejects.toThrow('GAME_NOT_ACTIVE');
    expect(txMock.gamePlayer.updateMany)
      .not.toHaveBeenCalled();
  });

  it('does not publish an event if the database update fails', async () => {
    mockConnectionDatabase('CONNECTED');
    txMock.gamePlayer.updateMany.mockReset();
    txMock.gamePlayer.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    await expect(
      service.markDisconnected(randomUUID(), 1)
    ).rejects.toThrow('CONNECTION_STATE_CHANGED');
    expect(eventsMock.publish).not.toHaveBeenCalled();
  });
// ==========================================
// PART 13B — TEST HELPERS
// ==========================================
const leavePlayers4 = [
  ...players3,
  {
    id: 14,
    userId: 4,
    role: 'DETECTIVE',
    participationStatus: 'ACTIVE',
    connectionStatus: 'CONNECTED',
  },
];
function mockLeaveDatabase(
  players = players3,
  phase:
    | 'DISCUSSION'
    | 'FINISHED'
    | 'TERMINATED' = 'DISCUSSION',
) {
  const gameId = randomUUID();
  const roomId = randomUUID();
  txMock.game.findUnique.mockResolvedValueOnce({
    roomId,
    phase,
    players,
  });
  txMock.gamePlayer.updateMany.mockResolvedValueOnce({
    count: 1,
  });
  txMock.game.updateMany.mockResolvedValueOnce({
    count: 1,
  });
  return { gameId, roomId };
}
// ==========================================
// 8. INTENTIONAL LEAVING
// ==========================================
it('terminates immediately when the Spy leaves', async () => {
  const { gameId, roomId } = mockLeaveDatabase();
  const result = await service.leaveGame(
    gameId,
    1, // Spy
    dbDeadline.getTime(),
  );
  expect(result.changed).toBe(true);
  expect(result.finalResult).toEqual({
    gameId,
    roomId,
    status: 'TERMINATED',
    winner: null,
    reason: 'SPY_DEPARTED',
    endedAt: dbDeadline.toISOString(),
  });
  expect(txMock.gamePlayer.updateMany)
    .toHaveBeenCalledWith({
      where: {
        id: 11,
        gameId,
        participationStatus: 'ACTIVE',
      },
      data: {
        participationStatus: 'DEPARTED',
      },
    });
  expect(txMock.game.updateMany)
    .toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phase: 'TERMINATED',
          terminationReason: 'SPY_DEPARTED',
          winner: null,
          phaseEndsAt: null,
        }),
      }),
    );
  expect(eventsMock.publish).toHaveBeenNthCalledWith(
    1,
    {
      name: 'game.player_updated',
      roomId,
      payload: {
        gameId,
        userId: 1,
        participationStatus: 'DEPARTED',
      },
    },
  );
  expect(eventsMock.publish).toHaveBeenNthCalledWith(
    2,
    {
      name: 'game.ended',
      roomId,
      payload: result.finalResult,
    },
  );
});
it('terminates when a Detective leaves a 3-player game', async () => {
  const { gameId } = mockLeaveDatabase();
  const result = await service.leaveGame(
    gameId,
    2,
    dbDeadline.getTime(),
  );
  expect(result.finalResult?.status).toBe('TERMINATED');
  expect(result.finalResult?.winner).toBeNull();
  expect(result.finalResult?.reason)
    .toBe('INSUFFICIENT_PLAYERS');
  expect(eventsMock.publish).toHaveBeenCalledTimes(2);
});
it('continues when a Detective leaves a 4-player game', async () => {
  const { gameId, roomId } =
    mockLeaveDatabase(leavePlayers4);
  const result = await service.leaveGame(
    gameId,
    2,
    dbDeadline.getTime(),
  );
  expect(result.changed).toBe(true);
  expect(result.finalResult).toBeNull();
  expect(txMock.game.updateMany)
    .not.toHaveBeenCalled();
  expect(eventsMock.publish).toHaveBeenCalledTimes(1);
  expect(eventsMock.publish).toHaveBeenCalledWith({
    name: 'game.player_updated',
    roomId,
    payload: {
      gameId,
      userId: 2,
      participationStatus: 'DEPARTED',
    },
  });
});
it('does not count temporary disconnection as departure', async () => {
  const players = leavePlayers4.map(player =>
    player.id === 13
      ? {
          ...player,
          connectionStatus: 'DISCONNECTED',
        }
      : player
  );
  const { gameId } = mockLeaveDatabase(players);
  const result = await service.leaveGame(
    gameId,
    2,
    dbDeadline.getTime(),
  );
  // Three players remain ACTIVE, including the
  // temporarily disconnected player.
  expect(result.finalResult).toBeNull();
  expect(txMock.game.updateMany).not.toHaveBeenCalled();
});
it('ignores repeated leave requests after termination', async () => {
  const players = players3.map(player =>
    player.id === 11
      ? { ...player, participationStatus: 'DEPARTED' }
      : player
  );
  const { gameId } = mockLeaveDatabase(
    players,
    'TERMINATED',
  );
  const result = await service.leaveGame(gameId, 1);
  expect(result.changed).toBe(false);
  expect(result.finalResult).toBeNull();
  expect(txMock.gamePlayer.updateMany)
    .not.toHaveBeenCalled();
  expect(eventsMock.publish)
    .not.toHaveBeenCalled();
});
it('rejects leaving by an eliminated player', async () => {
  const players = players3.map(player =>
    player.id === 12
      ? {
          ...player,
          participationStatus: 'ELIMINATED',
        }
      : player
  );
  const { gameId } = mockLeaveDatabase(players);
  await expect(
    service.leaveGame(gameId, 2),
  ).rejects.toThrow('PLAYER_NOT_ACTIVE');
  expect(eventsMock.publish).not.toHaveBeenCalled();
});
it('rejects a user outside the game', async () => {
  const { gameId } = mockLeaveDatabase();
  await expect(
    service.leaveGame(gameId, 999),
  ).rejects.toThrow('NOT_GAME_PARTICIPANT');
  expect(txMock.gamePlayer.updateMany)
    .not.toHaveBeenCalled();
});
it('rejects leaving after the game has finished', async () => {
  const { gameId } = mockLeaveDatabase(
    players3,
    'FINISHED',
  );
  await expect(
    service.leaveGame(gameId, 1),
  ).rejects.toThrow('GAME_NOT_ACTIVE');
  expect(eventsMock.publish).not.toHaveBeenCalled();
});
it('rejects leaving an unknown game', async () => {
  txMock.game.findUnique.mockResolvedValueOnce(null);
  await expect(
    service.leaveGame(randomUUID(), 1),
  ).rejects.toThrow('GAME_NOT_FOUND');
  expect(eventsMock.publish).not.toHaveBeenCalled();
});
it('does not publish when the player update fails', async () => {
  const { gameId } = mockLeaveDatabase();
  txMock.gamePlayer.updateMany.mockReset();
  txMock.gamePlayer.updateMany.mockResolvedValueOnce({
    count: 0,
  });
  await expect(
    service.leaveGame(gameId, 1),
  ).rejects.toThrow('PLAYER_STATE_CHANGED');
  expect(txMock.game.updateMany).not.toHaveBeenCalled();
  expect(eventsMock.publish).not.toHaveBeenCalled();
});
it('does not publish when game termination fails', async () => {
  const { gameId } = mockLeaveDatabase();
  txMock.game.updateMany.mockReset();
  txMock.game.updateMany.mockResolvedValueOnce({
    count: 0,
  });
  await expect(
    service.leaveGame(gameId, 1),
  ).rejects.toThrow('GAME_STATE_CHANGED');
  expect(eventsMock.publish).not.toHaveBeenCalled();
});
it('retries round resolution without publishing duplicate events', async () => {
  const { gameId } = mockRoundResolution([11, 11, 12]);
  // First transaction fails before any DB operation.
  // The next call uses the normal transaction mock.
  prismaMock.$transaction.mockRejectedValueOnce({
    code: 'P2034',
  });
  const result = await service.resolveRound(
    gameId,
    dbDeadline.getTime(),
  );
  expect(result.nextPhase).toBe('FINISHED');
  expect(result.finalResult?.winner).toBe('DETECTIVES');
  // One rejected attempt + one successful attempt.
  expect(prismaMock.$transaction)
    .toHaveBeenCalledTimes(2);
  // Only the successful transaction produces events.
  expect(eventsMock.publish).toHaveBeenCalledTimes(3);
  expect(eventsMock.publish).toHaveBeenNthCalledWith(
    3,
    {
      name: 'game.ended',
      roomId: result.roomId,
      payload: result.finalResult,
    },
  );
});
});
