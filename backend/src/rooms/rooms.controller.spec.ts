import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

describe('RoomsController', () => {
  let roomsController: RoomsController;
  let findAllMock: ReturnType<typeof vi.fn>;
  let createRoomMock: ReturnType<typeof vi.fn>;
  let findOneMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findAllMock = vi.fn();
    createRoomMock = vi.fn();
    findOneMock = vi.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        {
          provide: RoomsService,
          useValue: {
            findAll: findAllMock,
            createRoom: createRoomMock,
            findOne: findOneMock,
          },
        },
      ],
    }).compile();

    roomsController = moduleRef.get<RoomsController>(RoomsController);
  });

    describe('findAll', () => {
        it('should return public rooms', async () => {
            const publicRooms = [
                {
                    id: 1,
                    name: 'Room Alpha',
                    maxPlayers: 8,
                    isPrivate: false,
                    status: 'WAITING',
                },
            ];

            findAllMock.mockResolvedValue(publicRooms);

            const result = await roomsController.findAll();

            expect(result).toEqual(publicRooms);

            expect(findAllMock).toHaveBeenCalledTimes(1);
        })
    });
    describe('create', () => {
        const dto = {
        name: 'Room Alpha',
        max_players: 6,
        is_private: false,
        };

        it('should create a room using the authenticated user id', async () => {
            const response = { room: { id: 'room-uuid-1' }, inviteCode: null };
            createRoomMock.mockResolvedValue(response);

            const result = await roomsController.create(dto, {
                user: { id: 42 },
            } as any);

            expect(result).toEqual(response);
            expect(createRoomMock).toHaveBeenCalledWith(dto, 42);
        });
    });

    describe('findOne', () => {
        const roomId = '550e8400-e29b-41d4-a716-446655440000';

        it('should return a room using the authenticated user id', async () => {
            const room = { id: roomId, name: 'Room Alpha' };
            findOneMock.mockResolvedValue(room);

            const result = await roomsController.findOne(roomId, {
                user: { id: 42 },
            } as any);

            expect(result).toEqual(room);
            expect(findOneMock).toHaveBeenCalledWith(roomId, 42);
        });
    });
});