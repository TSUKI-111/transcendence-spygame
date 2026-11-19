import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

import { RoomsController } from '../src/rooms/rooms.controller.js';
import { RoomsService } from '../src/rooms/rooms.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RequireUserGuard } from '../src/auth/guards/require-user.guard.js';
import { RoomEventsPublisher } from '../src/rooms/events/room-events.publisher.js';

describe('RoomsController (e2e)', () => {
  let app: INestApplication<App>;
  const transactionClient = {
    $queryRaw: vi.fn(),

    room: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },

    roomPlayer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  const prismaMock = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    ),

    roomPlayer: {
      findUnique: vi.fn(),
    },

    room: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const authenticatedUserId = 42;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        RoomsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RoomEventsPublisher,
          useValue: {
            publishPlayerJoined: vi.fn(),
            publishPlayerLeft: vi.fn(),
            publishHostChanged: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(RequireUserGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              user?: { id: number };
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: authenticatedUserId };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('S1: creates a public room without returning an invitation code', async () => {
    prismaMock.roomPlayer.findUnique.mockResolvedValue(null);

    prismaMock.room.create.mockImplementation(async ({ data }) => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: data.name,
      hostId: data.hostId,
      maxPlayers: data.maxPlayers,
      status: 'WAITING',
      isPrivate: data.isPrivate,
      inviteCode: data.inviteCode,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    }));

    const response = await request(app.getHttpServer())
      .post('/rooms')
      .send({
        name: 'Soirée espions',
        max_players: 6,
        is_private: false,
      })
      .expect(201);

    expect(response.body).not.toHaveProperty('inviteCode');
    expect(response.body.room).not.toHaveProperty('inviteCode');

    expect(prismaMock.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Soirée espions',
        maxPlayers: 6,
        isPrivate: false,
        hostId: authenticatedUserId,
        inviteCode: null,
        players: {
          create: { userId: authenticatedUserId },
        },
      }),
    });
  });

  it('S2: creates a private room and returns its invitation code only once', async () => {
    prismaMock.roomPlayer.findUnique.mockResolvedValue(null);

    prismaMock.room.create.mockImplementation(async ({ data }) => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: data.name,
      hostId: data.hostId,
      maxPlayers: data.maxPlayers,
      status: 'WAITING',
      isPrivate: data.isPrivate,
      inviteCode: data.inviteCode,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    }));

    const response = await request(app.getHttpServer())
      .post('/rooms')
      .send({
        name: 'Salon privé',
        max_players: 4,
        is_private: true,
      })
      .expect(201);

    expect(response.body.inviteCode).toEqual(expect.any(String));
    expect(response.body.inviteCode).toHaveLength(8);

    expect(response.body.room).not.toHaveProperty('inviteCode');

    const prismaCall = prismaMock.room.create.mock.calls[0];
    const savedHash = prismaCall[0].data.inviteCode;

    expect(savedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(savedHash).not.toBe(response.body.inviteCode);

    expect(prismaMock.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Salon privé',
        maxPlayers: 4,
        isPrivate: true,
        hostId: authenticatedUserId,
        inviteCode: savedHash,
        players: {
          create: { userId: authenticatedUserId },
        },
      }),
    });

    expect(JSON.stringify(response.body.room)).not.toContain(
      response.body.inviteCode,
    );
  });

  it('S3: rejects an invalid room name without creating a room', async () => {
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .send({
        name: 'ab',
        max_players: 6,
        is_private: false,
      })
      .expect(400);

    expect(response.body).toHaveProperty('statusCode', 400);
    expect(prismaMock.room.create).not.toHaveBeenCalled();
  });

  it('S3: rejects a capacity above 8 without creating a room', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .send({
        name: 'Soirée espions',
        max_players: 9,
        is_private: false,
      })
      .expect(400);

    expect(prismaMock.room.create).not.toHaveBeenCalled();
  });

  it('S4: returns 409 when the user already belongs to an active room', async () => {
    prismaMock.roomPlayer.findUnique.mockResolvedValue({
      room: { status: 'WAITING' },
    });

    await request(app.getHttpServer())
      .post('/rooms')
      .send({
        name: 'Autre salon',
        max_players: 6,
        is_private: false,
      })
      .expect(409);

    expect(prismaMock.room.create).not.toHaveBeenCalled();
  });

  it('S5: allows an authenticated user to join a public waiting room', async () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    const room = {
      id: roomId,
      name: 'Public Room',
      hostId: 10,
      maxPlayers: 6,
      status: 'WAITING',
      isPrivate: false,
    };

    const updatedRoom = {
      ...room,
      players: [
        {
          user: {
            id: 10,
            displayName: 'Host',
          },
        },
        {
          user: {
            id: authenticatedUserId,
            displayName: 'Test User',
          },
        },
      ],
    };

    transactionClient.$queryRaw.mockResolvedValue([{ id: roomId }]);

    transactionClient.room.findUnique
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(updatedRoom);

    transactionClient.roomPlayer.findUnique.mockResolvedValue(null);
    transactionClient.roomPlayer.findFirst.mockResolvedValue(null);
    transactionClient.roomPlayer.count.mockResolvedValue(1);
    transactionClient.roomPlayer.create.mockResolvedValue({
      roomId,
      userId: authenticatedUserId,
    });

    const response = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/join`)
      .expect(200);

    expect(response.body.id).toBe(roomId);

    expect(transactionClient.roomPlayer.create).toHaveBeenCalledWith({
      data: {
        roomId,
        userId: authenticatedUserId,
      },
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when the room ID is not a valid UUID', async () => {
    await request(app.getHttpServer())
      .post('/rooms/invalid-id/join')
      .expect(400);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('S10: returns public rooms without exposing invitation codes', async () => {
    prismaMock.room.findMany.mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Salon public',
        host: { id: 42, displayName: 'Test User' },
        players: [{ userId: 42 }],
        maxPlayers: 6,
        status: 'WAITING',
        isPrivate: false,
        createdAt: new Date('2026-10-29T10:00:00Z'),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/rooms')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].playersCount).toBe(1);
    expect(response.body[0]).not.toHaveProperty('inviteCode');

    expect(prismaMock.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPrivate: false, status: 'WAITING' },
      }),
    );
  });

  it('S9: denies access to a private room when the user is not a member', async () => {
    prismaMock.room.findUnique.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Salon privé',
      host: { id: 10, displayName: 'Host' },
      players: [{ user: { id: 10, displayName: 'Host' } }],
      maxPlayers: 6,
      status: 'WAITING',
      isPrivate: true,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });

    prismaMock.roomPlayer.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/rooms/550e8400-e29b-41d4-a716-446655440000')
      .expect(403);
  });

  it('S10: allows a member to view a private room without exposing its invitation code', async () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    prismaMock.room.findUnique.mockResolvedValue({
      id: roomId,
      name: 'Salon privé',
      host: { id: 10, displayName: 'Host' },
      players: [
        { user: { id: 10, displayName: 'Host' } },
        { user: { id: authenticatedUserId, displayName: 'Test User' } },
      ],
      maxPlayers: 6,
      status: 'WAITING',
      isPrivate: true,
      createdAt: new Date('2026-10-29T10:00:00Z'),
    });

    prismaMock.roomPlayer.findUnique.mockResolvedValue({
      roomId,
      userId: authenticatedUserId,
    });

    const response = await request(app.getHttpServer())
      .get(`/rooms/${roomId}`)
      .expect(200);

    expect(response.body).not.toHaveProperty('inviteCode');
    expect(response.body.playersCount).toBe(2);
    expect(response.body.players).toHaveLength(2);
    expect(response.body.players[1]).toEqual({
      id: authenticatedUserId,
      displayName: 'Test User',
    });
  });
  describe('POST /rooms/join-by-invite', () => {
    const inviteCode = 'ABCD2345';
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    const privateRoom = {
      id: roomId,
      name: 'Private Room',
      hostId: 10,
      maxPlayers: 6,
      status: 'WAITING',
      isPrivate: true,
    };

    const updatedRoom = {
      ...privateRoom,
      players: [
        {
          user: {
            id: 10,
            displayName: 'Host',
          },
        },
        {
          user: {
            id: authenticatedUserId,
            displayName: 'Test User',
          },
        },
      ],
    };

    beforeEach(() => {
      transactionClient.$queryRaw.mockResolvedValue([{ id: roomId }]);

      transactionClient.room.findUnique
        .mockResolvedValueOnce(privateRoom)
        .mockResolvedValueOnce(updatedRoom);

      transactionClient.roomPlayer.findUnique.mockResolvedValue(null);
      transactionClient.roomPlayer.findFirst.mockResolvedValue(null);
      transactionClient.roomPlayer.count.mockResolvedValue(1);
      transactionClient.roomPlayer.create.mockResolvedValue({
        roomId,
        userId: authenticatedUserId,
      });
    });

    // 1. Successful invitation
    it('should allow a user to join a private room with a valid invitation code', async () => {
      const response = await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode })
        .expect(200);

      expect(response.body.id).toBe(roomId);

      expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);

      expect(transactionClient.roomPlayer.create).toHaveBeenCalledWith({
        data: {
          roomId,
          userId: authenticatedUserId,
        },
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    // 2. Invalid invitation code
    it('should return 404 when the invitation code does not exist', async () => {
      transactionClient.$queryRaw.mockResolvedValue([]);

      await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode })
        .expect(404);

      expect(transactionClient.room.findUnique).not.toHaveBeenCalled();
      expect(transactionClient.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 3. Invalid invitation format
    it('should return 400 when the invitation code format is invalid', async () => {
      await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode: 'abc123' })
        .expect(400);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // 4. Room already in game
    it('should return 409 when the private room is already in game', async () => {
      transactionClient.room.findUnique.mockReset();
      transactionClient.room.findUnique.mockResolvedValue({
        ...privateRoom,
        status: 'IN_GAME',
      });

      await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode })
        .expect(409);

      expect(transactionClient.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 5. Room is full
    it('should return 409 when the private room is full', async () => {
      transactionClient.roomPlayer.count.mockResolvedValue(6);

      await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode })
        .expect(409);

      expect(transactionClient.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 6. User already belongs to the room
    it('should return 409 when the user is already a member of the private room', async () => {
      transactionClient.roomPlayer.findUnique.mockResolvedValue({
        roomId,
        userId: authenticatedUserId,
      });

      await request(app.getHttpServer())
        .post('/rooms/join-by-invite')
        .send({ inviteCode })
        .expect(409);

      expect(transactionClient.roomPlayer.create).not.toHaveBeenCalled();
    });
  });
  describe('POST /rooms/:id/start', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    const waitingRoom = {
      id: roomId,
      hostId: authenticatedUserId,
      status: 'WAITING',
      maxPlayers: 8,
    };

    const startedRoom = {
      id: roomId,
      name: 'Room Alpha',
      host: {
        id: 42,
        displayName: 'Host',
      },
      maxPlayers: 8,
      status: 'IN_GAME',
      isPrivate: false,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      players: [
        { user: { id: 42, displayName: 'Host' } },
        { user: { id: 20, displayName: 'Player 2' } },
        { user: { id: 30, displayName: 'Player 3' } },
      ],
    };

    beforeEach(() => {
      transactionClient.$queryRaw
        .mockReset()
        .mockResolvedValue([{ id: roomId }]);

      transactionClient.room.findUnique
        .mockReset()
        .mockResolvedValue(waitingRoom);

      transactionClient.roomPlayer.count.mockReset().mockResolvedValue(3);

      transactionClient.room.update.mockReset().mockResolvedValue(startedRoom);
    });

    it('S18: should ignore a client-supplied hostId', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .send({ hostId: 99 })
        .expect(200);

      expect(response.body.host.id).toBe(authenticatedUserId);
      expect(response.body.host.id).not.toBe(99);

      expect(transactionClient.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'IN_GAME' },
        }),
      );
    });

    it('should start a room when the authenticated user is the host and there are at least 3 players', async () => {
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .expect(200);

      expect(response.body.host).toEqual({
        id: 42,
        displayName: 'Host',
      });

      expect(response.body.playersCount).toBe(3);

      expect(response.body.players).toEqual([
        { id: 42, displayName: 'Host' },
        { id: 20, displayName: 'Player 2' },
        { id: 30, displayName: 'Player 3' },
      ]);
      expect(response.body.status).toBe('IN_GAME');
      expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
      expect(transactionClient.roomPlayer.count).toHaveBeenCalledWith({
        where: { roomId },
      });
      expect(transactionClient.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: roomId },
          data: { status: 'IN_GAME' },
        }),
      );
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when the room does not exist', async () => {
      transactionClient.$queryRaw.mockResolvedValue([]);

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .expect(404);

      expect(transactionClient.room.update).not.toHaveBeenCalled();
    });

    it('should return 403 when the authenticated user is not the host', async () => {
      transactionClient.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        hostId: 99,
      });

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .expect(403);

      expect(transactionClient.room.update).not.toHaveBeenCalled();
    });

    it('should return 409 when the room is not in WAITING status', async () => {
      transactionClient.room.findUnique.mockResolvedValue({
        ...waitingRoom,
        status: 'IN_GAME',
      });

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .expect(409);

      expect(transactionClient.roomPlayer.count).not.toHaveBeenCalled();
      expect(transactionClient.room.update).not.toHaveBeenCalled();
    });

    it('should return 409 when the room has fewer than 3 players', async () => {
      transactionClient.roomPlayer.count.mockResolvedValue(2);

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .expect(409);

      expect(transactionClient.room.update).not.toHaveBeenCalled();
    });

    it('should return 400 when the room ID is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .post('/rooms/invalid-id/start')
        .expect(400);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
  it('should allow an authenticated player to leave a room', async () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    const room = {
      id: roomId,
      hostId: 10,
    };

    const updatedRoom = {
      id: roomId,
      hostId: 10,
      name: 'Public Room',
      maxPlayers: 6,
      status: 'WAITING',
      isPrivate: false,
      players: [
        {
          user: {
            id: 10,
            displayName: 'Host',
          },
        },
        {
          user: {
            id: 20,
            displayName: 'Another Player',
          },
        },
      ],
    };

    // Verrouillage de la room.
    transactionClient.$queryRaw.mockResolvedValue([{ id: roomId }]);

    // Vérification de l'appartenance.
    transactionClient.roomPlayer.findUnique.mockResolvedValue({
      roomId,
      userId: authenticatedUserId,
    });

    // Première lecture : room avant suppression.
    // Deuxième lecture : room après suppression.
    transactionClient.room.findUnique
      .mockResolvedValueOnce(room)
      .mockResolvedValueOnce(updatedRoom);

    transactionClient.roomPlayer.delete.mockResolvedValue({
      roomId,
      userId: authenticatedUserId,
    });

    transactionClient.roomPlayer.count.mockResolvedValue(2);

    const response = await request(app.getHttpServer())
      .post(`/rooms/${roomId}/leave`)
      .expect(200);

    // Vérifier la réponse HTTP.
    expect(response.body.roomDeleted).toBe(false);
    expect(response.body.room.id).toBe(roomId);
    expect(response.body.room.players).toHaveLength(2);

    // Vérifier la suppression du joueur authentifié.
    expect(transactionClient.roomPlayer.delete).toHaveBeenCalledWith({
      where: {
        roomId_userId: {
          roomId,
          userId: authenticatedUserId,
        },
      },
    });

    // Vérifier que la transaction a été exécutée.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
  it('should return 404 when the authenticated user is not a room member', async () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    transactionClient.$queryRaw.mockResolvedValue([{ id: roomId }]);

    transactionClient.roomPlayer.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(`/rooms/${roomId}/leave`)
      .expect(404);

    expect(transactionClient.roomPlayer.delete).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
  it('should return 400 when leaving with an invalid room UUID', async () => {
    await request(app.getHttpServer())
      .post('/rooms/invalid-id/leave')
      .expect(400);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
