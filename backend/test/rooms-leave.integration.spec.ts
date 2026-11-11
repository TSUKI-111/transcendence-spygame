import { randomBytes } from 'node:crypto';

import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service.js';

import { RoomsService } from '../src/rooms/rooms.service.js';
import { RoomEventsPublisher } from '../src/rooms/events/room-events.publisher.js';

const TEST_DATABASE_NAME = 'transcendence_test';

interface TestFixture {
  roomId?: string;
  hostId?: number;
  playerIds: number[];
}

let prisma: PrismaService | undefined;
let roomsService: RoomsService | undefined;
let databaseConnected = false;

const fixtures: TestFixture[] = [];

describe('RoomsService - Leave room integration', () => {
  beforeAll(async () => {
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

    const db = new PrismaService();
    prisma = db;

    await db.$connect();
    databaseConnected = true;

    const roomEventsPublisher = new RoomEventsPublisher();
    roomsService = new RoomsService(db, roomEventsPublisher);
  });
  it('should remove a normal player from a WAITING room', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    // Créer le host.
    const host = await db.user.create({
      data: {
        username: `leave_${runId}_host`,
        displayName: 'Leave Test Host',
        email: `leave_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    // Créer deux joueurs.
    for (let i = 1; i <= 2; i++) {
      const player = await db.user.create({
        data: {
          username: `leave_${runId}_player${i}`,
          displayName: `Leave Test Player ${i}`,
          email: `leave_${runId}_player${i}@test.local`,
          passwordHash: 'integration-test-hash',
        },
      });

      fixture.playerIds.push(player.id);
    }

    // Créer une room avec les trois membres.
    const room = await db.room.create({
      data: {
        name: `Leave Test ${runId}`,
        hostId: host.id,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
        players: {
          create: [
            { userId: host.id },
            { userId: fixture.playerIds[0] },
            { userId: fixture.playerIds[1] },
          ],
        },
      },
    });

    fixture.roomId = room.id;

    // Le premier joueur quitte.
    const result = await service.leaveRoom(room.id, fixture.playerIds[0]);

    // Vérifier le résultat retourné.
    expect(result.roomDeleted).toBe(false);

    if (result.roomDeleted) {
      throw new Error('Room should not have been deleted');
    }

    expect(result.room?.players).toHaveLength(2);

    // Vérifier directement PostgreSQL.
    const remainingPlayers = await db.roomPlayer.count({
      where: { roomId: room.id },
    });

    expect(remainingPlayers).toBe(2);

    const membership = await db.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: fixture.playerIds[0],
        },
      },
    });

    expect(membership).toBeNull();

    // Le host ne doit pas changer.
    const updatedRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(updatedRoom?.hostId).toBe(host.id);
  });
  it('should transfer host to the oldest remaining player', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    // 1. Créer le host.
    const host = await db.user.create({
      data: {
        username: `transfer_${runId}_host`,
        displayName: 'Transfer Test Host',
        email: `transfer_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    // 2. Créer deux joueurs.
    for (let i = 1; i <= 2; i++) {
      const player = await db.user.create({
        data: {
          username: `transfer_${runId}_player${i}`,
          displayName: `Transfer Player ${i}`,
          email: `transfer_${runId}_player${i}@test.local`,
          passwordHash: 'integration-test-hash',
        },
      });

      fixture.playerIds.push(player.id);
    }

    // 3. Créer la room.
    const room = await db.room.create({
      data: {
        name: `Transfer Test ${runId}`,
        hostId: host.id,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
        players: {
          create: [
            { userId: host.id },
            { userId: fixture.playerIds[0] },
            { userId: fixture.playerIds[1] },
          ],
        },
      },
    });

    fixture.roomId = room.id;

    // 4. Le host quitte.
    const result = await service.leaveRoom(room.id, host.id);

    // 5. Vérifier que la room existe toujours.
    expect(result.roomDeleted).toBe(false);

    if (result.roomDeleted) {
      throw new Error('Room should not have been deleted');
    }

    // 6. Vérifier le transfert du host.
    expect(result.room?.hostId).toBe(fixture.playerIds[0]);

    // 7. Vérifier directement PostgreSQL.
    const updatedRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(updatedRoom?.hostId).toBe(fixture.playerIds[0]);

    const remainingPlayers = await db.roomPlayer.count({
      where: { roomId: room.id },
    });

    expect(remainingPlayers).toBe(2);
  });
  it('should delete room when the last player leaves', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    // 1. Créer le host.
    const host = await db.user.create({
      data: {
        username: `delete_${runId}_host`,
        displayName: 'Delete Test Host',
        email: `delete_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    // 2. Créer une room avec uniquement son host.
    const room = await db.room.create({
      data: {
        name: `Delete Test ${runId}`,
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

    // 3. Le dernier joueur quitte.
    const result = await service.leaveRoom(room.id, host.id);

    // 4. Vérifier le résultat retourné.
    expect(result).toEqual({
      roomDeleted: true,
    });

    // 5. Vérifier directement PostgreSQL.
    const deletedRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(deletedRoom).toBeNull();

    const remainingPlayers = await db.roomPlayer.count({
      where: { roomId: room.id },
    });

    expect(remainingPlayers).toBe(0);
  });
  it('should allow a player to leave an IN_GAME room', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    const host = await db.user.create({
      data: {
        username: `ingame_${runId}_host`,
        displayName: 'In Game Host',
        email: `ingame_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    const player = await db.user.create({
      data: {
        username: `ingame_${runId}_player`,
        displayName: 'In Game Player',
        email: `ingame_${runId}_player@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.playerIds.push(player.id);

    const room = await db.room.create({
      data: {
        name: `In Game Test ${runId}`,
        hostId: host.id,
        maxPlayers: 8,
        status: 'IN_GAME',
        isPrivate: false,
        players: {
          create: [{ userId: host.id }, { userId: player.id }],
        },
      },
    });

    fixture.roomId = room.id;

    const result = await service.leaveRoom(room.id, player.id);

    expect(result.roomDeleted).toBe(false);

    if (result.roomDeleted) {
      throw new Error('Room should not have been deleted');
    }

    expect(result.room?.players).toHaveLength(1);

    const updatedRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(updatedRoom?.status).toBe('IN_GAME');

    const membership = await db.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: player.id,
        },
      },
    });

    expect(membership).toBeNull();
  });
  it('should reject leaving when user is not a member', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    const host = await db.user.create({
      data: {
        username: `nonmember_${runId}_host`,
        displayName: 'Non Member Host',
        email: `nonmember_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    const outsider = await db.user.create({
      data: {
        username: `nonmember_${runId}_outsider`,
        displayName: 'Outsider',
        email: `nonmember_${runId}_outsider@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.playerIds.push(outsider.id);

    const room = await db.room.create({
      data: {
        name: `Non Member Test ${runId}`,
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

    await expect(
      service.leaveRoom(room.id, outsider.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Vérifier que la room existe toujours.
    const existingRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(existingRoom).not.toBeNull();

    // Vérifier que le host est toujours membre.
    const remainingPlayers = await db.roomPlayer.count({
      where: { roomId: room.id },
    });

    expect(remainingPlayers).toBe(1);
  });
  it('should handle two simultaneous departures correctly', async () => {
    const db = prisma;
    const service = roomsService;

    if (!db || !service) {
      throw new Error('Test dependencies are not initialized');
    }

    const runId = randomBytes(6).toString('hex');

    const fixture: TestFixture = {
      playerIds: [],
    };

    fixtures.push(fixture);

    // 1. Créer le host.
    const host = await db.user.create({
      data: {
        username: `concurrent_${runId}_host`,
        displayName: 'Concurrent Host',
        email: `concurrent_${runId}_host@test.local`,
        passwordHash: 'integration-test-hash',
      },
    });

    fixture.hostId = host.id;

    // 2. Créer deux joueurs.
    for (let i = 1; i <= 2; i++) {
      const player = await db.user.create({
        data: {
          username: `concurrent_${runId}_player${i}`,
          displayName: `Concurrent Player ${i}`,
          email: `concurrent_${runId}_player${i}@test.local`,
          passwordHash: 'integration-test-hash',
        },
      });

      fixture.playerIds.push(player.id);
    }

    // 3. Créer la room.
    const room = await db.room.create({
      data: {
        name: `Concurrent Leave ${runId}`,
        hostId: host.id,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
        players: {
          create: [
            { userId: host.id },
            { userId: fixture.playerIds[0] },
            { userId: fixture.playerIds[1] },
          ],
        },
      },
    });

    fixture.roomId = room.id;

    // 4. Faire quitter les deux joueurs simultanément.
    const results = await Promise.allSettled([
      service.leaveRoom(room.id, fixture.playerIds[0]),
      service.leaveRoom(room.id, fixture.playerIds[1]),
    ]);

    // 5. Les deux départs doivent réussir.
    const successes = results.filter((result) => result.status === 'fulfilled');

    const failures = results.filter((result) => result.status === 'rejected');

    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(0);

    // 6. Vérifier l'état final dans PostgreSQL.
    const remainingPlayers = await db.roomPlayer.findMany({
      where: { roomId: room.id },
      select: { userId: true },
    });

    expect(remainingPlayers).toHaveLength(1);
    expect(remainingPlayers[0]?.userId).toBe(host.id);

    const updatedRoom = await db.room.findUnique({
      where: { id: room.id },
    });

    expect(updatedRoom).not.toBeNull();
    expect(updatedRoom?.hostId).toBe(host.id);
  });
  afterAll(async () => {
    const db = prisma;

    if (!db) return;

    try {
      if (databaseConnected) {
        for (const fixture of fixtures) {
          if (fixture.roomId) {
            await db.roomPlayer.deleteMany({
              where: { roomId: fixture.roomId },
            });

            await db.room.deleteMany({
              where: { id: fixture.roomId },
            });
          }

          const userIds = [
            ...fixture.playerIds,
            ...(fixture.hostId !== undefined ? [fixture.hostId] : []),
          ];

          if (userIds.length > 0) {
            await db.user.deleteMany({
              where: { id: { in: userIds } },
            });
          }
        }
      }
    } finally {
      await db.$disconnect();
    }
  });
});
