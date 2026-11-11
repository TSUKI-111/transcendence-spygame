import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RoomsService } from '../src/rooms/rooms.service.js';
import { RoomEventsPublisher } from '../src/rooms/events/room-events.publisher.js';

const ROUND_COUNT = 5;
const CANDIDATE_COUNT = 8;
const TEST_DATABASE_NAME = 'transcendence_test';

interface TestFixture {
  roomId?: string;
  hostId?: number;
  candidateIds: number[];
  startRoomId?: string;
  startHostId?: number;
  startPlayerIds: number[];
}

let prisma: PrismaService | undefined;
let roomsService: RoomsService | undefined;
let databaseConnected = false;

// On conserve chaque ID dès que sa création réussit.
const fixtures: TestFixture[] = [];

describe('RoomsService - PostgreSQL concurrency integration', () => {
  beforeAll(async () => {
    // 1. Vérifier précisément la base de données ciblée.
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing');
    }

    let databaseName: string;

    try {
      databaseName = decodeURIComponent(
        new URL(databaseUrl).pathname.replace(/^\/+/, ''),
      );
    } catch {
      throw new Error('DATABASE_URL is not a valid database URL');
    }

    if (databaseName !== TEST_DATABASE_NAME) {
      throw new Error(
        `Safety check failed: expected ${TEST_DATABASE_NAME}, received ${databaseName}`,
      );
    }

    // 2. Initialiser le vrai PrismaService.
    const db = new PrismaService();
    prisma = db;

    await db.$connect();
    databaseConnected = true;

    // 3. Initialiser le vrai RoomsService.
    const roomEventsPublisher = new RoomEventsPublisher();
    roomsService = new RoomsService(db, roomEventsPublisher);

    // Identifiant aléatoire pour éviter les collisions entre exécutions.
    const runId = randomBytes(6).toString('hex');

    // 4. Préparer cinq scénarios indépendants.
    for (let round = 1; round <= ROUND_COUNT; round++) {
      const fixture: TestFixture = {
        candidateIds: [],
        startPlayerIds: [],
      };

      // Important : enregistrer le scénario avant de créer ses données.
      // Ainsi, même un échec au milieu de sa préparation est nettoyable.
      fixtures.push(fixture);

      // Créer le host.
      const host = await db.user.create({
        data: {
          username: `s7_${runId}_r${round}_host`,
          displayName: `S7 Host ${round}`,
          email: `s7_${runId}_r${round}_host@test.local`,
          passwordHash: 'integration-test-hash',
        },
      });

      fixture.hostId = host.id;

      // Créer les huit candidats séquentiellement.
      // Chaque ID est enregistré immédiatement après sa création.
      for (let index = 0; index < CANDIDATE_COUNT; index++) {
        const candidate = await db.user.create({
          data: {
            username: `s7_${runId}_r${round}_c${index}`,
            displayName: `S7 Candidate ${round}-${index}`,
            email: `s7_${runId}_r${round}_c${index}@test.local`,
            passwordHash: 'integration-test-hash',
          },
        });

        fixture.candidateIds.push(candidate.id);
      }

      // Créer une room de capacité 8 avec son host.
      const room = await db.room.create({
        data: {
          name: `S7 Concurrency ${runId} R${round}`,
          hostId: host.id,
          maxPlayers: 8,
          status: 'WAITING',
          isPrivate: false,
          players: {
            create: {
              userId: host.id,
            },
          },
        },
      });

      fixture.roomId = room.id;
    }

    // S43: fixture dédiée au double démarrage.
    const startFixture: TestFixture = {
      candidateIds: [],
      startPlayerIds: [],
    };

    fixtures.push(startFixture);

    const startRunId = randomBytes(6).toString('hex');

    const startHost = await db.user.create({
      data: {
        username: `s43_${startRunId}_host`,
        displayName: 'S43 Host',
        email: `s43_${startRunId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    startFixture.startHostId = startHost.id;

    for (let index = 0; index < 2; index++) {
      const player = await db.user.create({
        data: {
          username: `s43_${startRunId}_p${index}`,
          displayName: `S43 Player ${index}`,
          email: `s43_${startRunId}_p${index}@test.local`,
          passwordHash: 'integration-test-hash',
        },
      });

      startFixture.startPlayerIds.push(player.id);
    }

    const startRoom = await db.room.create({
      data: {
        name: `S43 Start ${startRunId}`,
        hostId: startHost.id,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
        players: {
          create: [
            { userId: startHost.id },
            ...startFixture.startPlayerIds.map((userId) => ({ userId })),
          ],
        },
      },
    });

    startFixture.startRoomId = startRoom.id;
  });

  afterAll(async () => {
    const db = prisma;

    if (!db) {
      return;
    }

    const cleanupErrors: string[] = [];

    // Une erreur de nettoyage ne doit pas empêcher les autres suppressions.
    const attemptCleanup = async (
      label: string,
      action: () => Promise<unknown>,
    ) => {
      try {
        await action();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        cleanupErrors.push(`${label}: ${message}`);
      }
    };

    try {
      if (databaseConnected) {
        for (const fixture of fixtures) {
          // 1. Collecter toutes les rooms de cette fixture.
          const roomIds = [
            ...(fixture.roomId ? [fixture.roomId] : []),
            ...(fixture.startRoomId ? [fixture.startRoomId] : []),
          ];

          // 2. Supprimer d'abord les associations room-player.
          for (const currentRoomId of roomIds) {
            await attemptCleanup(`roomPlayer cleanup (${currentRoomId})`, () =>
              db.roomPlayer.deleteMany({
                where: { roomId: currentRoomId },
              }),
            );
          }

          // 3. Supprimer les rooms avant les utilisateurs.
          for (const currentRoomId of roomIds) {
            await attemptCleanup(`room cleanup (${currentRoomId})`, () =>
              db.room.deleteMany({
                where: { id: currentRoomId },
              }),
            );
          }

          // 4. Supprimer uniquement les utilisateurs créés par cette fixture.
          const userIds = [
            ...fixture.candidateIds,
            ...(fixture.hostId !== undefined ? [fixture.hostId] : []),
            ...fixture.startPlayerIds,
            ...(fixture.startHostId !== undefined ? [fixture.startHostId] : []),
          ];

          if (userIds.length > 0) {
            await attemptCleanup(
              `users cleanup (${userIds.length} users)`,
              () =>
                db.user.deleteMany({
                  where: {
                    id: { in: userIds },
                  },
                }),
            );
          }
        }
      }
    } finally {
      // Toujours tenter de fermer la connexion, même si le nettoyage échoue.
      await attemptCleanup('Prisma disconnect', () => db.$disconnect());
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`S7 cleanup failed:\n${cleanupErrors.join('\n')}`);
    }
  });

  // S7.2 : cinq vagues de concurrence indépendantes.
  it.each(Array.from({ length: ROUND_COUNT }, (_, index) => index + 1))(
    'should accept exactly 7 of 8 simultaneous joins (round %i)',
    async (roundNumber) => {
      const fixture = fixtures[roundNumber - 1];
      const service = roomsService;

      // Vérifier que le scénario a été préparé correctement.
      expect(fixture).toBeDefined();
      expect(fixture?.candidateIds).toHaveLength(CANDIDATE_COUNT);

      if (!fixture?.roomId || !service) {
        throw new Error(
          `Test fixture ${roundNumber} was not initialized completely`,
        );
      }

      const currentRoomId = fixture.roomId;

      // 1. Lancer les huit tentatives simultanément.
      const results = await Promise.allSettled(
        fixture.candidateIds.map((userId) =>
          service.joinRoom(currentRoomId, userId),
        ),
      );

      // 2. Séparer les succès et les échecs.
      const successes = results.filter(
        (result) => result.status === 'fulfilled',
      );

      const failures = results.filter((result) => result.status === 'rejected');

      // 3. Vérifier les quantités.
      expect(successes).toHaveLength(7);
      expect(failures).toHaveLength(1);

      // S7.1 : vérifier le type exact de l'exception.
      const rejectedResult = failures[0];

      expect(rejectedResult).toBeDefined();

      if (!rejectedResult || rejectedResult.status !== 'rejected') {
        throw new Error('Expected exactly one rejected join');
      }

      expect(rejectedResult.reason).toBeInstanceOf(ConflictException);
      expect(rejectedResult.reason.getStatus()).toBe(409);

      // 4. Vérifier directement le résultat dans PostgreSQL.
      const finalCount = await prisma!.roomPlayer.count({
        where: { roomId: currentRoomId },
      });

      expect(finalCount).toBe(8);
    },
  );
  it('S43: should allow only one successful concurrent room start', async () => {
    const fixture = fixtures[ROUND_COUNT];
    const service = roomsService;

    expect(fixture).toBeDefined();

    if (
      !fixture?.startRoomId ||
      fixture.startHostId === undefined ||
      !service
    ) {
      throw new Error('S43 fixture was not initialized completely');
    }

    const results = await Promise.allSettled([
      service.startRoom(fixture.startRoomId, fixture.startHostId),
      service.startRoom(fixture.startRoomId, fixture.startHostId),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled');

    const failures = results.filter((result) => result.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const rejected = failures[0];

    expect(rejected).toBeDefined();

    if (!rejected || rejected.status !== 'rejected') {
      throw new Error('Expected one rejected start request');
    }

    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect(rejected.reason.getStatus()).toBe(409);

    const finalRoom = await prisma!.room.findUnique({
      where: { id: fixture.startRoomId },
      select: { status: true },
    });

    expect(finalRoom?.status).toBe('IN_GAME');
  });
});
