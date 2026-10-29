import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from '../src/rooms/rooms.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';


describe('RoomsService', () => {
    let roomsService: RoomsService;
    let findManyMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        findManyMock = vi.fn();

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                RoomsService,
                {
                    provide: PrismaService,
                    useValue: {
                        room: {
                            findMany: findManyMock,
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
                id: '550e8400-e29b-41d4-a716-446655440000',
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
                id: '550e8400-e29b-41d4-a716-446655440000',
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

            expect(result[0]).not.toHaveProperty('players');
            expect(result[0]).not.toHaveProperty('inviteCode');
        })
    })


})