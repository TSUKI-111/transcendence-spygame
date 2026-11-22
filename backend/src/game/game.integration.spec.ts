
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';


import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GameService } from './game.service.js';
import { GameEventsService } from './game-events.service.js';


const databaseUrl = process.env.INTEGRATION_DATABASE_URL;

// Without a dedicated database URL, skip these tests.
// Normal unit tests can still run without PostgreSQL.
describe.skipIf(!databaseUrl)(
  'Game Engine — PostgreSQL integration',
  () => {
    let prisma: PrismaClient;
    let service: GameService;
    let events: GameEventsService;

    beforeAll(async () => {
      const parsed = new URL(databaseUrl!);

      // Safety: never run these tests against the dev DB.
      if (
        parsed.hostname !== '127.0.0.1' ||
        parsed.port !== '55433' ||
        parsed.pathname !== '/spy_game_integration' ||
        parsed.username !== 'spy_test'
      ) {
        throw new Error('UNSAFE_INTEGRATION_DATABASE');
      }

      const adapter = new PrismaPg({
        connectionString: databaseUrl!,
      });

      prisma = new PrismaClient({ adapter });
      await prisma.$connect();

      events = new GameEventsService();

      service = new GameService(
        prisma as unknown as PrismaService,
        events,
      );
    });

    afterAll(async () => {
      await prisma?.$disconnect();
    });

    // Create real users and a real room.
    // Each test receives its own data.
    async function createFixture(count: number = 3) {
      const tag = randomUUID().replaceAll('-', '');

      const users = [];

      for (let i = 0; i < count; i++) {
        const user = await prisma.user.create({
          data: {
            username: `it_${tag}_${i}`,
            displayName: `Test Player ${i}`,
            email: `it_${tag}_${i}@example.test`,
            passwordHash: 'integration-test-only',
          },
        });

        users.push(user);
      }

      const room = await prisma.room.create({
        data: {
          name: `Integration ${tag}`,
          hostId: users[0].id,
          maxPlayers: count,
          isPrivate: false,
        },
      });

      await prisma.roomPlayer.createMany({
        data: users.map(user => ({
          roomId: room.id,
          userId: user.id,
        })),
      });

      return { users, room };
    }

    // ==========================================
    // TEST 1 — Real game creation
    // ==========================================

    it('persists the game, players and first round', async () => {
      const { users, room } = await createFixture();

      const started = await service.startGame({
        roomId: room.id,
        participantIds: users.map(user => user.id),
      });

      const saved = await prisma.game.findUnique({
        where: { id: started.gameId },
        include: {
          players: true,
          rounds: true,
        },
      });

      expect(saved).not.toBeNull();
      expect(saved?.roomId).toBe(room.id);
      expect(saved?.phase).toBe('CLUE_SUBMISSION');

      expect(saved?.players).toHaveLength(3);
      expect(saved?.rounds).toHaveLength(1);
      expect(saved?.rounds[0].number).toBe(1);

      expect(
        saved?.players.filter(p => p.role === 'SPY')
      ).toHaveLength(1);

      expect(
        saved?.players.filter(p => p.role === 'DETECTIVE')
      ).toHaveLength(2);

      // The Spy must never receive the secret word.
      const spy = saved!.players.find(p => p.role === 'SPY')!;

      const privateState = await service.getPlayerState(
        started.gameId,
        spy.userId,
      );

      expect(privateState).not.toHaveProperty('secretWord');
    });

    // ==========================================
    // TEST 2 — Atomic game creation
    // ==========================================

    it('does not save a partial game if a user is missing', async () => {
      const { users, room } = await createFixture();

      // This user does not exist in our isolated test DB.
      const missingUserId = 2_147_483_647;

      await expect(
        service.startGame({
          roomId: room.id,
          participantIds: [
            users[0].id,
            users[1].id,
            missingUserId,
          ],
        })
      ).rejects.toThrow();

      // The nested create failed; no game should exist.
      const saved = await prisma.game.findUnique({
        where: { roomId: room.id },
      });

      expect(saved).toBeNull();
    });

    // ==========================================
    // TEST 3 — Real duplicate-vote protection
    // ==========================================

    it('stores only one vote from concurrent requests', async () => {
      const { users, room } = await createFixture();

      const started = await service.startGame({
        roomId: room.id,
        participantIds: users.map(user => user.id),
      });

      // Prepare the voting phase for this test.
      await prisma.game.update({
        where: { id: started.gameId },
        data: {
          phase: 'VOTING',
          phaseEndsAt: new Date(Date.now() + 60_000),
        },
      });

      const voterId = users[0].id;
      const targetId = users[1].id;

      // Send two votes without waiting between them.
      const results = await Promise.allSettled([
        service.submitVote(
          started.gameId, voterId, targetId
        ),
        service.submitVote(
          started.gameId, voterId, targetId
        ),
      ]);

      expect(
        results.filter(r => r.status === 'fulfilled')
      ).toHaveLength(1);

      const rejected = results.find(
        r => r.status === 'rejected'
      );

      expect(rejected?.status).toBe('rejected');

      if (rejected?.status === 'rejected') {
        expect(rejected.reason.message)
          .toBe('VOTE_ALREADY_SUBMITTED');
      }

      const round = await prisma.gameRound.findUnique({
        where: {
          gameId_number: {
            gameId: started.gameId,
            number: 1,
          },
        },
      });

      const voteCount = await prisma.vote.count({
        where: { roundId: round!.id },
      });

      expect(voteCount).toBe(1);
    });

    // ==========================================
    // TEST 4 — Real victory and transaction
    // ==========================================

    it('commits a Detective victory when the Spy is eliminated', async () => {
      const { users, room } = await createFixture();

      const started = await service.startGame({
        roomId: room.id,
        participantIds: users.map(user => user.id),
      });

      const players = await prisma.gamePlayer.findMany({
        where: { gameId: started.gameId },
      });

      const spy = players.find(p => p.role === 'SPY')!;
      const detectives = players.filter(
        p => p.role === 'DETECTIVE'
      );

      // Enter voting with time remaining.
      await prisma.game.update({
        where: { id: started.gameId },
        data: {
          phase: 'VOTING',
          phaseEndsAt: new Date(Date.now() + 60_000),
        },
      });

      // Both Detectives vote for the Spy.
      for (const detective of detectives) {
        await service.submitVote(
          started.gameId,
          detective.userId,
          spy.userId,
        );
      }

      // Simulate the server-side voting deadline.
      await prisma.game.update({
        where: { id: started.gameId },
        data: {
          phaseEndsAt: new Date(Date.now() - 1000),
        },
      });

      const listener = vi.fn();
      const unsubscribe = events.subscribe(listener);

      try {
        const result = await service.resolveRound(
          started.gameId,
        );

        expect(result.nextPhase).toBe('FINISHED');
        expect(result.finalResult?.winner)
          .toBe('DETECTIVES');

        const savedGame = await prisma.game.findUnique({
          where: { id: started.gameId },
        });

        expect(savedGame?.phase).toBe('FINISHED');
        expect(savedGame?.winner).toBe('DETECTIVES');
        expect(savedGame?.endedAt).not.toBeNull();

        const savedSpy = await prisma.gamePlayer.findUnique({
          where: { id: spy.id },
        });

        expect(savedSpy?.participationStatus)
          .toBe('ELIMINATED');

        const round = await prisma.gameRound.findUnique({
          where: {
            gameId_number: {
              gameId: started.gameId,
              number: 1,
            },
          },
        });

        expect(round?.outcome).toBe('ELIMINATED');
        expect(round?.eliminatedGamePlayerId)
          .toBe(spy.id);

        expect(
          listener.mock.calls.map(([event]) => event.name)
        ).toEqual([
          'game.player_updated',
          'game.round_resolved',
          'game.ended',
        ]);
      } finally {
        unsubscribe();
      }
    });

    // ==========================================
    // TEST 5 — Real transaction rollback
    // ==========================================

    it('rolls back resolution if creating the next round fails', async () => {
      const { users, room } = await createFixture(4);

      const started = await service.startGame({
        roomId: room.id,
        participantIds: users.map(user => user.id),
      });

      // Force a voting deadline that has expired.
      await prisma.game.update({
        where: { id: started.gameId },
        data: {
          phase: 'VOTING',
          phaseEndsAt: new Date(Date.now() - 1000),
        },
      });

      // Deliberately create Round 2 ahead of time.
      // The Game Engine will later try to create it again.
      await prisma.gameRound.create({
        data: {
          gameId: started.gameId,
          number: 2,
        },
      });

      const listener = vi.fn();
      const unsubscribe = events.subscribe(listener);

      try {
        // No votes means the game should create Round 2.
        // But Round 2 already exists, so PostgreSQL
        // rejects the duplicate with P2002.
        await expect(
          service.resolveRound(started.gameId)
        ).rejects.toMatchObject({
          code: 'P2002',
        });

        // Verify the earlier transaction changes
        // were rolled back.
        const savedGame = await prisma.game.findUnique({
          where: { id: started.gameId },
        });

        expect(savedGame?.phase).toBe('VOTING');
        expect(savedGame?.currentRoundNumber).toBe(1);
        expect(savedGame?.winner).toBeNull();

        const round1 = await prisma.gameRound.findUnique({
          where: {
            gameId_number: {
              gameId: started.gameId,
              number: 1,
            },
          },
        });

        expect(round1?.outcome).toBeNull();
        expect(round1?.resolvedAt).toBeNull();

        // No events from a failed transaction.
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });


// ==========================================
// PART 14C — REAL CONCURRENCY TESTS
// ==========================================

it('rejects clues after the game enters discussion', async () => {
  const { users, room } = await createFixture();

  const started = await service.startGame({
    roomId: room.id,
    participantIds: users.map(user => user.id),
  });

  await prisma.game.update({
    where: { id: started.gameId },
    data: {
      phase: 'DISCUSSION',
      phaseEndsAt: new Date(Date.now() + 60_000),
    },
  });

  await expect(
    service.submitClue(
      started.gameId,
      users[0].id,
      'Beach',
    ),
  ).rejects.toThrow('INVALID_PHASE');

  const round = await prisma.gameRound.findUnique({
    where: {
      gameId_number: {
        gameId: started.gameId,
        number: 1,
      },
    },
  });

  const count = await prisma.clue.count({
    where: { roundId: round!.id },
  });

  expect(count).toBe(0);
});

it('keeps only one of two identical concurrent clues', async () => {
  const { users, room } = await createFixture();

  const started = await service.startGame({
    roomId: room.id,
    participantIds: users.map(user => user.id),
  });

  const results = await Promise.allSettled([
    service.submitClue(
      started.gameId,
      users[0].id,
      'Beach',
    ),
    service.submitClue(
      started.gameId,
      users[1].id,
      'beach',
    ),
  ]);

  expect(
    results.filter(result => result.status === 'fulfilled')
  ).toHaveLength(1);

  const rejected = results.find(
    result => result.status === 'rejected'
  );

  expect(rejected?.status).toBe('rejected');

  if (rejected?.status === 'rejected') {
    expect(rejected.reason.message).toBe('DUPLICATE_CLUE');
  }

  const round = await prisma.gameRound.findUnique({
    where: {
      gameId_number: {
        gameId: started.gameId,
        number: 1,
      },
    },
  });

  const count = await prisma.clue.count({
    where: { roundId: round!.id },
  });

  expect(count).toBe(1);
});

it('rejects a vote when another transaction changes the phase', async () => {
  const { users, room } = await createFixture();

  const started = await service.startGame({
    roomId: room.id,
    participantIds: users.map(user => user.id),
  });

  await prisma.game.update({
    where: { id: started.gameId },
    data: {
      phase: 'VOTING',
      phaseEndsAt: new Date(Date.now() + 60_000),
    },
  });

  let signalLocked!: () => void;
  let releaseLock!: () => void;

  const locked = new Promise<void>(resolve => {
    signalLocked = resolve;
  });

  const released = new Promise<void>(resolve => {
    releaseLock = resolve;
  });

  // Transaction A locks the game and changes its phase.
  const blocker = prisma.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "games"
      WHERE "id" = ${started.gameId}::uuid
      FOR NO KEY UPDATE
    `;

    signalLocked();

    await released;

    await tx.game.update({
      where: { id: started.gameId },
      data: {
        phase: 'DISCUSSION',
        phaseEndsAt: new Date(Date.now() + 60_000),
      },
    });
  }, {
    isolationLevel: 'ReadCommitted',
    timeout: 10_000,
  });

  await locked;

  // Transaction B tries to submit a vote.
  const submission = service.submitVote(
    started.gameId,
    users[0].id,
    users[1].id,
  );

  // Let transaction A commit the phase change.
  releaseLock();
  await blocker;

  // The vote must not be accepted in DISCUSSION.
  await expect(submission).rejects.toThrow('INVALID_PHASE');

  const round = await prisma.gameRound.findUnique({
    where: {
      gameId_number: {
        gameId: started.gameId,
        number: 1,
      },
    },
  });

  const voteCount = await prisma.vote.count({
    where: { roundId: round!.id },
  });

  expect(voteCount).toBe(0);
});

  },
);
