import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { NotFoundException } from '@nestjs/common';

describe('RoomsController', () => {
  let roomsController: RoomsController;
  let findAllMock: ReturnType<typeof vi.fn>;
  let createRoomMock: ReturnType<typeof vi.fn>;
  let findOneMock: ReturnType<typeof vi.fn>;
  let joinRoomMock: ReturnType<typeof vi.fn>;
  let joinByInviteCodeMock: ReturnType<typeof vi.fn>;
  let startRoomMock: ReturnType<typeof vi.fn>;
  let leaveRoomMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findAllMock = vi.fn();
    createRoomMock = vi.fn();
    findOneMock = vi.fn();
    joinRoomMock = vi.fn();
    joinByInviteCodeMock = vi.fn();
    startRoomMock = vi.fn();
    leaveRoomMock = vi.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        {
          provide: RoomsService,
          useValue: {
            findAll: findAllMock,
            createRoom: createRoomMock,
            findOne: findOneMock,
            joinRoom: joinRoomMock,
            joinByInviteCode: joinByInviteCodeMock,
            startRoom: startRoomMock,
            leaveRoom: leaveRoomMock,
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
    });
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
  describe('join', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    it('should join a room using the authenticated user id', async () => {
      const room = {
        id: roomId,
        name: 'Room Alpha',
        status: 'WAITING',
      };

      joinRoomMock.mockResolvedValue(room);

      const result = await roomsController.join(roomId, {
        user: { id: 42 },
      } as any);

      expect(result).toEqual(room);

      expect(joinRoomMock).toHaveBeenCalledWith(roomId, 42);
      expect(joinRoomMock).toHaveBeenCalledTimes(1);
    });
  });
  describe('joinByCode', () => {
    const dto = {
      inviteCode: 'ABCD2345',
    };

    const userId = 42;

    it('should join a private room using the invitation code', async () => {
      const room = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Private Room',
        status: 'WAITING',
      };

      joinByInviteCodeMock.mockResolvedValue(room);

      const result = await roomsController.joinByCode(dto, {
        user: { id: userId },
      } as any);

      expect(result).toEqual(room);

      expect(joinByInviteCodeMock).toHaveBeenCalledWith(dto, userId);

      expect(joinByInviteCodeMock).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from RoomsService', async () => {
      const error = new NotFoundException('Room not found');

      joinByInviteCodeMock.mockRejectedValue(error);

      await expect(
        roomsController.joinByCode(dto, {
          user: { id: userId },
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('start', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 42;

    it('should start a room using the authenticated user id', async () => {
      const response = {
        id: roomId,
        name: 'Room Alpha',
        status: 'IN_GAME',
      };

      startRoomMock.mockResolvedValue(response);

      const result = await roomsController.start(roomId, {
        user: { id: userId },
      } as any);

      expect(result).toEqual(response);
      expect(startRoomMock).toHaveBeenCalledWith(roomId, userId);
      expect(startRoomMock).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from RoomsService', async () => {
      const error = new NotFoundException('Room not found');

      startRoomMock.mockRejectedValue(error);

      await expect(
        roomsController.start(roomId, {
          user: { id: userId },
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(startRoomMock).toHaveBeenCalledWith(roomId, userId);
    });
  });
  describe('leave', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 42;

    it('should allow an authenticated user to leave a room', async () => {
      const response = {
        roomDeleted: false,
        room: {
          id: roomId,
          name: 'Room Alpha',
          hostId: 20,
        },
      };

      leaveRoomMock.mockResolvedValue(response);

      const result = await roomsController.leave(roomId, {
        user: { id: userId },
      } as any);

      expect(result).toEqual(response);

      expect(leaveRoomMock).toHaveBeenCalledWith(roomId, userId);
      expect(leaveRoomMock).toHaveBeenCalledTimes(1);
    });

    it('should return roomDeleted true when the last player leaves', async () => {
      const response = {
        roomDeleted: true,
      };

      leaveRoomMock.mockResolvedValue(response);

      const result = await roomsController.leave(roomId, {
        user: { id: userId },
      } as any);

      expect(result).toEqual({
        roomDeleted: true,
      });

      expect(leaveRoomMock).toHaveBeenCalledWith(roomId, userId);
    });

    it('should propagate errors from RoomsService', async () => {
      const error = new NotFoundException(
        'Player is not a member of this room',
      );

      leaveRoomMock.mockRejectedValue(error);

      await expect(
        roomsController.leave(roomId, {
          user: { id: userId },
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(leaveRoomMock).toHaveBeenCalledWith(roomId, userId);
    });
  });
});
