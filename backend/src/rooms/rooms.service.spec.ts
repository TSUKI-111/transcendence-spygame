import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from '../rooms/rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { hashInviteCode } from './invite-code.js';
import { ConflictException } from '@nestjs/common';

describe('RoomsService', () => {
    let roomsService: RoomsService;
    let findManyMock: ReturnType<typeof vi.fn>;
    let createMock: ReturnType<typeof vi.fn>;
    let findUniqueMock: ReturnType<typeof vi.fn>;
    let roomPlayerFindUniqueMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        findManyMock = vi.fn();
        createMock = vi.fn();
        findUniqueMock = vi.fn();
        roomPlayerFindUniqueMock = vi.fn();

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                RoomsService,
                {
                    provide: PrismaService,
                    useValue: {
                        room: {
                            findMany: findManyMock,
                            findUnique: findUniqueMock,
                            create: createMock,
                        },
                        roomPlayer: {
                            findUnique: roomPlayerFindUniqueMock,
                        },
                    },
                },
            ],
        }).compile();

        roomsService = moduleRef.get<RoomsService>(RoomsService);
    })

    describe('findAll', () => {
        it('should return public rooms', async () => {
            const publicRooms = [
                {
                    id: 1,
                    name: 'Room publique',
                    host: {
                        id: 10,
                        displayName: 'Marouan',
                    },
                    players: [{ userId: 1 }, { userId: 2 }],
                    maxPlayers: 8,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                },
            ];

            findManyMock.mockResolvedValue(publicRooms);
            const result = await roomsService.findAll();
            expect(result[0].playersCount).toBe(2);
            expect(result[0]).not.toHaveProperty('players');
            expect(result[0]).not.toHaveProperty('inviteCode');
             expect(findManyMock).toHaveBeenCalledWith({
                    where: {
                        isPrivate: false,
                        status: 'WAITING',
                    },
                    select: {
                        id: true,
                        name: true,
                        host: {
                            select: {
                                id: true,
                                displayName: true,
                            },
                        },
                        players: {
                            select: {
                                userId: true,
                            },
                        },
                        maxPlayers: true,
                        status: true,
                        isPrivate: true,
                        createdAt: true,
                    },
                });

            expect(result).toEqual([
                {
                    id: 1,
                    name: 'Room publique',
                    host: {
                    id: 10,
                    displayName: 'Marouan',
                    },
                    maxPlayers: 8,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                    playersCount: 2,
                },
            ]);
            expect(findManyMock).toHaveBeenCalledTimes(1);
        })
        it('should return multiple public rooms', async () => {
            const publicRooms = [
                {
                    id: 1,
                    name: 'Room Alpha',
                    host: { id: 10, displayName: 'Marouan' },
                    players: [{ userId: 1 }, { userId: 2 }],
                    maxPlayers: 8,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                },
                {
                    id: 2,
                    name: 'Room Beta',
                    host: { id: 20, displayName: 'Yassine' },
                    players: [{ userId: 3 }],
                    maxPlayers: 5,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T11:00:00Z'),
                },
            ];

            findManyMock.mockResolvedValue(publicRooms);

            const result = await roomsService.findAll();

            expect(result).toEqual([
                {
                    id: 1,
                    name: 'Room Alpha',
                    host: { id: 10, displayName: 'Marouan' },
                    maxPlayers: 8,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                    playersCount: 2,
                },
                {
                    id: 2,
                    name: 'Room Beta',
                    host: { id: 20, displayName: 'Yassine' },
                    maxPlayers: 5,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T11:00:00Z'),
                    playersCount: 1,
                },
            ]);

            expect(result).toHaveLength(2);
        });
        it('should return an empty array when no public rooms exist', async () => {
            findManyMock.mockResolvedValue([]);
            const result = await roomsService.findAll();
            expect(result).toEqual([]);

            expect(result).toHaveLength(0);
        })
        it('should request only public rooms from Prisma', async () => {
            const publicRooms = [
                {
                    id: 1,
                    name: 'Room publique',
                    isPrivate: false,
                    players: [{ userId: 1 }],
                },
            ];

            findManyMock.mockResolvedValue(publicRooms);

            await roomsService.findAll();

            expect(findManyMock).toHaveBeenCalledWith(
                expect.objectContaining({
                where: { isPrivate: false, status: 'WAITING', },
                }),
            );
        });
        it('should never expose inviteCode in public room responses', async () => {
            const publicRooms = [
                {
                    id: 'room-uuid-1',
                    name: 'Room publique',
                    host: {
                        id: 10,
                        displayName: 'Marouan',
                    },
                    players: [{ userId: 1 }, { userId: 2 }],
                    maxPlayers: 8,
                    status: 'WAITING',
                    isPrivate: false,
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                },
            ];

            findManyMock.mockResolvedValue(publicRooms);

            const result = await roomsService.findAll();

            expect(result[0]).toMatchObject({
                id: 'room-uuid-1',
                name: 'Room publique',
                playersCount: 2,
            });

            expect(result[0]).not.toHaveProperty('players');

            for (const room of result) {
                expect(room).not.toHaveProperty('inviteCode');
            }

            expect(findManyMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    select: expect.not.objectContaining({
                        inviteCode: true,
                    }),
                }),
            );
        })
    });

    describe('createRoom', () => {
        it('should create a public room', async () => {
            const dto: CreateRoomDto = {
                name: 'Room publique',
                max_players: 8,
                is_private: false,
            };

            const userId = 42;

            const createdRoom = {
                id: 1,
                name: 'Room publique',
                maxPlayers: 8,
                isPrivate: false,
                hostId: userId,
                status: 'WAITING',
                createdAt: new Date('2026-10-24T10:00:00Z'),
            };

            createMock.mockResolvedValue(createdRoom);

            const result = await roomsService.createRoom(dto, userId);
            expect(result).not.toHaveProperty('inviteCode');
            expect(createMock).toHaveBeenCalledWith({
                data: {
                    name: 'Room publique',
                    maxPlayers: 8,
                    isPrivate: false,
                    hostId: userId,
                    inviteCode: null,
                    players: {
                        create: {
                            userId,
                        }
                    },
                },
            });

            expect(result).toEqual({
                room: {
                    id: 1,
                    name: 'Room publique',
                    maxPlayers: 8,
                    isPrivate: false,
                    hostId: userId,
                    status: 'WAITING',
                    createdAt: new Date('2026-10-24T10:00:00Z'),
                }
            });
        });
        it('should create a private room with an invitation code', async () => {
            const dto = {
                name: 'Room privée',
                max_players: 4,
                is_private: true,
            };

            const userId = 42;

            const createdRoom = {
                id: 2,
                name: 'Room privée',
                maxPlayers: 4,
                isPrivate: true,
                hostId: userId,
                inviteCode: 'a'.repeat(64),
                status: 'WAITING',
                createdAt: new Date('2026-10-24T10:00:00Z'),
            };

            createMock.mockResolvedValue(createdRoom);

            const result = await roomsService.createRoom(dto, userId);

            expect(createMock).toHaveBeenCalledWith(
                expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Room privée',
                    maxPlayers: 4,
                    isPrivate: true,
                    hostId: userId,
                    inviteCode: expect.stringMatching(/^[0-9a-f]{64}$/),
                }),
                }),
            );

            const prismaData = createMock.mock.calls[0][0].data;

            expect(prismaData.inviteCode).toBe(hashInviteCode(result.inviteCode!));

            expect(result.inviteCode).toEqual(expect.any(String));
            expect(result.inviteCode).toHaveLength(8);

            expect(result.room).not.toHaveProperty('inviteCode');
        });

        it('should throw an error when Prisma fails', async () => {
            const dto = {
                name: 'Room publique',
                max_players: 8,
                is_private: false,
            };

            const userId = 42;
            const error = new Error('Database error');

            createMock.mockRejectedValue(error);

            await expect(
                roomsService.createRoom(dto, userId),
            ).rejects.toThrow('Database error');

            expect(createMock).toHaveBeenCalled();
        })
        it('should throw ConflictException if user already belongs to an active room', async () => {
            roomPlayerFindUniqueMock.mockResolvedValue({
                room: { status: 'WAITING' },
            });

            const dto: CreateRoomDto = {
                name: 'Another Room',
                max_players: 6,
                is_private: false,
            };

            await expect(
                roomsService.createRoom(dto, 42),
            ).rejects.toBeInstanceOf(ConflictException);

            expect(createMock).not.toHaveBeenCalled();
        })
    });

    describe('findOne', () => {
        const roomId = '550e8400-e29b-41d4-a716-446655440000';
        const userId = 42;

        const privateRoom = {
            id: roomId,
            name: 'Room privée',
            host: {
                id: 10,
                displayName: 'Marouan',
            },
            players: [
                {
                user: {
                    id: 10,
                    displayName: 'Marouan',
                },
                },
                {
                user: {
                    id: 42,
                    displayName: 'Yassine',
                },
                },
            ],
            maxPlayers: 4,
            status: 'WAITING',
            isPrivate: true,
            createdAt: new Date('2026-10-24T10:00:00Z'),
        };

        it('should throw NotFoundException when the room does not exist', async () => {
            findUniqueMock.mockResolvedValue(null);

            await expect(
            roomsService.findOne(roomId, userId),
            ).rejects.toThrow('Room not found');

            expect(findUniqueMock).toHaveBeenCalledTimes(1);
            expect(roomPlayerFindUniqueMock).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException when the user is not a member of a private room', async () => {
            findUniqueMock.mockResolvedValue(privateRoom);
            roomPlayerFindUniqueMock.mockResolvedValue(null);

            await expect(
            roomsService.findOne(roomId, userId),
            ).rejects.toThrow('You are not a member of this private room', );

            expect(roomPlayerFindUniqueMock).toHaveBeenCalledWith({
                where: {
                    roomId_userId: {
                        roomId,
                        userId,
                    },
                },
            });
        });

        it('should return a private room to a member without exposing inviteCode', async () => {
            findUniqueMock.mockResolvedValue(privateRoom);
            roomPlayerFindUniqueMock.mockResolvedValue({
                roomId,
                userId,
            });

            const result = await roomsService.findOne(roomId, userId);

            expect(result.players).toEqual([
            { id: 10, displayName: 'Marouan' },
            { id: 42, displayName: 'Yassine' },
            ]);

            expect(result.playersCount).toBe(2);
            expect(result).not.toHaveProperty('inviteCode');
            expect(result).not.toHaveProperty('players.user');
        });
    });


})