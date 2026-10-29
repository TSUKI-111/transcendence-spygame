import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

import { RoomsController } from '../src/rooms/rooms.controller.js';
import { RoomsService } from '../src/rooms/rooms.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RequireUserGuard } from '../src/auth/guards/require-user.guard.js';

describe('RoomsController (e2e)', () => {
    let app: INestApplication<App>;

    const prismaMock = {
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
        await app.close();
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

        expect(JSON.stringify(response.body.room))
        .not.toContain(response.body.inviteCode);
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
});