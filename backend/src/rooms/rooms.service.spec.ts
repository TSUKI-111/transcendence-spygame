import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from '../rooms/rooms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { hashInviteCode } from './invite-code.js';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import type { RoomEvent } from './events/room-events.types.js';

describe('RoomsService', () => {
  let roomsService: RoomsService;
  let findManyMock: ReturnType<typeof vi.fn>;
  let createMock: ReturnType<typeof vi.fn>;
  let findUniqueMock: ReturnType<typeof vi.fn>;
  let roomPlayerFindUniqueMock: ReturnType<typeof vi.fn>;
  let transactionMock: ReturnType<typeof vi.fn>;
  let queryRawMock: ReturnType<typeof vi.fn>;
  let roomPlayerFindFirstMock: ReturnType<typeof vi.fn>;
  let roomPlayerCountMock: ReturnType<typeof vi.fn>;
  let roomPlayerCreateMock: ReturnType<typeof vi.fn>;
  let txMock: {
    $queryRaw: ReturnType<typeof vi.fn>;
    room: {
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    roomPlayer: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let roomFindUniqueMock: ReturnType<typeof vi.fn>;
  let roomPlayerDeleteMock: ReturnType<typeof vi.fn>;
  let roomDeleteMock: ReturnType<typeof vi.fn>;
  let roomUpdateMock: ReturnType<typeof vi.fn>;
  let roomEventsPublisher: RoomEventsPublisher;

  beforeEach(async () => {
    findManyMock = vi.fn();
    createMock = vi.fn();
    findUniqueMock = vi.fn();
    roomPlayerFindUniqueMock = vi.fn();
    queryRawMock = vi.fn();
    roomPlayerFindFirstMock = vi.fn();
    roomPlayerCountMock = vi.fn();
    roomPlayerCreateMock = vi.fn();
    roomFindUniqueMock = vi.fn();
    roomPlayerDeleteMock = vi.fn();
    roomDeleteMock = vi.fn();
    roomUpdateMock = vi.fn();

    txMock = {
      $queryRaw: queryRawMock,
      room: {
        findUnique: roomFindUniqueMock,
        delete: roomDeleteMock,
        update: roomUpdateMock,
      },
      roomPlayer: {
        findUnique: roomPlayerFindUniqueMock,
        findFirst: roomPlayerFindFirstMock,
        count: roomPlayerCountMock,
        create: roomPlayerCreateMock,
        delete: roomPlayerDeleteMock,
      },
    };

    transactionMock = vi.fn(async (callback) => callback(txMock));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        RoomEventsPublisher,
        {
          provide: PrismaService,
          useValue: {
            $transaction: transactionMock,
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
    roomEventsPublisher =
      moduleRef.get<RoomEventsPublisher>(RoomEventsPublisher);
  });

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
    });
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
    });
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
          where: { isPrivate: false, status: 'WAITING' },
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
    });
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
            },
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
        },
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

      await expect(roomsService.createRoom(dto, userId)).rejects.toThrow(
        'Database error',
      );

      expect(createMock).toHaveBeenCalled();
    });
    it('should throw ConflictException if user already belongs to an active room', async () => {
      roomPlayerFindUniqueMock.mockResolvedValue({
        room: { status: 'WAITING' },
      });

      const dto: CreateRoomDto = {
        name: 'Another Room',
        max_players: 6,
        is_private: false,
      };

      await expect(roomsService.createRoom(dto, 42)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(createMock).not.toHaveBeenCalled();
    });
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

      await expect(roomsService.findOne(roomId, userId)).rejects.toThrow(
        'Room not found',
      );

      expect(findUniqueMock).toHaveBeenCalledTimes(1);
      expect(roomPlayerFindUniqueMock).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when the user is not a member of a private room', async () => {
      findUniqueMock.mockResolvedValue(privateRoom);
      roomPlayerFindUniqueMock.mockResolvedValue(null);

      await expect(roomsService.findOne(roomId, userId)).rejects.toThrow(
        'You are not a member of this private room',
      );

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
  describe('joinRoom', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';
    const userId = 42;

    const room = {
      id: roomId,
      name: 'Room Alpha',
      maxPlayers: 8,
      status: 'WAITING',
      isPrivate: false,
    };

    const updatedRoom = {
      ...room,
      players: [
        {
          user: {
            id: 10,
            username: 'player1',
            displayName: 'Player 1',
          },
        },
        {
          user: {
            id: userId,
            username: 'player2',
            displayName: 'Player 2',
          },
        },
      ],
    };

    it('should allow a user to join a public waiting room', async () => {
      queryRawMock.mockResolvedValue([{ id: roomId }]);

      txMock.room.findUnique
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(updatedRoom);

      roomPlayerFindUniqueMock.mockResolvedValue(null);

      roomPlayerFindFirstMock.mockResolvedValue(null);

      roomPlayerCountMock.mockResolvedValue(1);

      roomPlayerCreateMock.mockResolvedValue({
        roomId,
        userId,
      });

      const publishJoinedSpy = vi.spyOn(
        roomEventsPublisher,
        'publishPlayerJoined',
      );

      const result = await roomsService.joinRoom(roomId, userId);

      expect(result).toEqual(updatedRoom);

      expect(publishJoinedSpy).toHaveBeenCalledTimes(1);

      expect(publishJoinedSpy).toHaveBeenCalledWith({
        roomId,
        player: {
          id: userId,
          username: 'player2',
          displayName: 'Player 2',
        },
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);

      expect(queryRawMock).toHaveBeenCalledTimes(1);

      expect(roomPlayerCreateMock).toHaveBeenCalledWith({
        data: {
          roomId,
          userId,
        },
      });

      expect(roomPlayerCountMock).toHaveBeenCalledWith({
        where: { roomId },
      });
    });
    it('should throw NotFoundException when the room does not exist', async () => {
      queryRawMock.mockResolvedValue([]);
      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException when joining a private room by ID', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Private Room',
        hostId: 1,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: true,
      });

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(NotFoundException);
    });
    it('should throw ConflictException when the room is already in game', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Game Room',
        hostId: 1,
        maxPlayers: 8,
        status: 'IN_GAME',
        isPrivate: false,
      });

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw ConflictException when the user is already a member of this room', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Public Room',
        hostId: 1,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
      });

      roomPlayerFindUniqueMock.mockResolvedValue({
        roomId: '00000000-0000-4000-8000-000000000001',
        userId: 2,
      });

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);

      expect(roomPlayerCountMock).not.toHaveBeenCalled();
      expect(roomPlayerCreateMock).not.toHaveBeenCalled();
    });
    it('should throw ConflictException when the user belongs to another room', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Public Room',
        hostId: 1,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
      });

      roomPlayerFindUniqueMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          roomId: '00000000-0000-4000-8000-000000000002',
          userId: 2,
        });

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);

      expect(roomPlayerCreateMock).not.toHaveBeenCalled();
    });
    it('should throw ConflictException when the room is full', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Public Room',
        hostId: 1,
        maxPlayers: 3,
        status: 'WAITING',
        isPrivate: false,
      });

      roomPlayerFindUniqueMock.mockResolvedValue(null);
      roomPlayerFindFirstMock.mockResolvedValue(null);
      roomPlayerCountMock.mockResolvedValue(3);

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);

      expect(roomPlayerCreateMock).not.toHaveBeenCalled();
    });
    it('should throw ConflictException when Prisma returns P2002 for userId', async () => {
      queryRawMock.mockResolvedValue([
        { id: '00000000-0000-4000-8000-000000000001' },
      ]);

      txMock.room.findUnique.mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Public Room',
        hostId: 1,
        maxPlayers: 8,
        status: 'WAITING',
        isPrivate: false,
      });

      roomPlayerFindUniqueMock.mockResolvedValue(null);
      roomPlayerFindFirstMock.mockResolvedValue(null);
      roomPlayerCountMock.mockResolvedValue(2);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.0',
          meta: { target: ['userId'] },
        },
      );

      roomPlayerCreateMock.mockRejectedValue(prismaError);

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw ConflictException when Prisma returns P2034', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or deadlock',
        {
          code: 'P2034',
          clientVersion: '7.10.0',
        },
      );

      transactionMock.mockRejectedValue(prismaError);

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw ServiceUnavailableException when Prisma returns P2024', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Timed out fetching a new connection from the connection pool',
        {
          code: 'P2024',
          clientVersion: '7.10.0',
        },
      );

      transactionMock.mockRejectedValue(prismaError);

      await expect(
        roomsService.joinRoom('00000000-0000-4000-8000-000000000001', 2),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('joinByInviteCode', () => {
    const inviteCode = 'ABCD2345';
    const hashedCode = hashInviteCode(inviteCode);
    const userId = 42;
    const roomId = '550e8400-e29b-41d4-a716-446655440000';

    const privateRoom = {
      id: roomId,
      name: 'Private Room',
      hostId: 1,
      maxPlayers: 8,
      status: 'WAITING',
      isPrivate: true,
      inviteCode: hashedCode,
    };

    const updatedRoom = {
      ...privateRoom,
      players: [
        {
          userId,
          roomId,
          user: {
            id: userId,
            username: 'testuser',
            displayName: 'Test User',
          },
        },
      ],
    };

    beforeEach(() => {
      vi.clearAllMocks();

      txMock.$queryRaw.mockResolvedValue([{ id: roomId }]);

      txMock.room.findUnique
        .mockResolvedValueOnce(privateRoom)
        .mockResolvedValueOnce(updatedRoom);

      txMock.roomPlayer.findUnique.mockResolvedValue(null);
      txMock.roomPlayer.findFirst.mockResolvedValue(null);
      txMock.roomPlayer.count.mockResolvedValue(1);

      txMock.roomPlayer.create.mockResolvedValue({
        roomId,
        userId,
      });
    });

    // 1. Success
    it('should join a private room successfully using a valid invite code', async () => {
      const publishJoinedSpy = vi.spyOn(
        roomEventsPublisher,
        'publishPlayerJoined',
      );
      const result = await roomsService.joinByInviteCode(
        { inviteCode },
        userId,
      );

      expect(result).toEqual(updatedRoom);

      expect(publishJoinedSpy).toHaveBeenCalledTimes(1);

      expect(publishJoinedSpy).toHaveBeenCalledWith({
        roomId,
        player: {
          id: userId,
          username: 'testuser',
          displayName: 'Test User',
        },
      });

      expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);

      expect(txMock.roomPlayer.create).toHaveBeenCalledWith({
        data: {
          roomId,
          userId,
        },
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);
    });

    // 2. Invalid invite code
    it('should throw NotFoundException when invite code does not exist', async () => {
      txMock.$queryRaw.mockResolvedValue([]);

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(NotFoundException);

      expect(txMock.room.findUnique).not.toHaveBeenCalled();
      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 3. Room is public
    it('should throw NotFoundException when the room is not private', async () => {
      txMock.room.findUnique.mockReset();
      txMock.room.findUnique.mockResolvedValue({
        ...privateRoom,
        isPrivate: false,
      });

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(NotFoundException);

      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 4. Room is already in game
    it('should throw ConflictException when room status is IN_GAME', async () => {
      txMock.room.findUnique.mockReset();
      txMock.room.findUnique.mockResolvedValue({
        ...privateRoom,
        status: 'IN_GAME',
      });

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);

      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 5. User already belongs to this room
    it('should throw ConflictException when user is already a member of this room', async () => {
      txMock.roomPlayer.findUnique.mockResolvedValue({
        roomId,
        userId,
      });

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);

      expect(txMock.roomPlayer.findFirst).not.toHaveBeenCalled();
      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 6. User belongs to another room
    it('should throw ConflictException when user already belongs to another room', async () => {
      txMock.roomPlayer.findUnique
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          roomId: 'another-room-id',
          userId,
        });

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);

      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 7. Room is full
    it('should throw ConflictException when room is full', async () => {
      txMock.roomPlayer.count.mockResolvedValue(8);

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);

      expect(txMock.roomPlayer.create).not.toHaveBeenCalled();
    });

    // 8. Prisma P2002
    it('should throw ConflictException when Prisma returns P2002', async () => {
      txMock.roomPlayer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
          meta: {
            target: ['userId'],
          },
        }),
      );

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);
    });

    // 9. Prisma P2034
    it('should throw ConflictException when Prisma returns P2034', async () => {
      txMock.roomPlayer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Transaction conflict', {
          code: 'P2034',
          clientVersion: '7.10.0',
        }),
      );

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ConflictException);
    });

    // 10. Prisma P2024
    it('should throw ServiceUnavailableException when Prisma returns P2024', async () => {
      txMock.roomPlayer.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Connection pool timeout', {
          code: 'P2024',
          clientVersion: '7.10.0',
        }),
      );

      await expect(
        roomsService.joinByInviteCode({ inviteCode }, userId),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('startRoom', () => {
    const roomId = '00000000-0000-4000-8000-000000000001';
    const hostId = 1;

    const startedRoom = {
      id: roomId,
      name: 'Room Alpha',
      host: {
        id: 1,
        displayName: 'Host',
      },
      maxPlayers: 8,
      status: 'IN_GAME',
      isPrivate: false,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      players: [
        {
          user: { id: 1, displayName: 'Host' },
        },
        {
          user: { id: 2, displayName: 'Player 2' },
        },
        {
          user: { id: 3, displayName: 'Player 3' },
        },
      ],
    };

    beforeEach(() => {
      queryRawMock.mockResolvedValue([{ id: roomId }]);
      roomFindUniqueMock.mockResolvedValue({
        id: roomId,
        hostId,
        status: 'WAITING',
      });
      roomPlayerCountMock.mockResolvedValue(3);
      roomUpdateMock.mockResolvedValue(startedRoom);
    });

    it('should start a room when the host has at least 3 players', async () => {
      const result = await roomsService.startRoom(roomId, hostId);

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      expect(roomFindUniqueMock).toHaveBeenCalledWith({
        where: { id: roomId },
        select: {
          id: true,
          hostId: true,
          status: true,
          maxPlayers: true,
        },
      });
      expect(roomPlayerCountMock).toHaveBeenCalledWith({
        where: { roomId },
      });
      expect(roomUpdateMock).toHaveBeenCalledWith({
        where: { id: roomId },
        data: { status: 'IN_GAME' },
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
              user: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
          maxPlayers: true,
          status: true,
          isPrivate: true,
          createdAt: true,
        },
      });

      expect(result).toEqual({
        id: roomId,
        name: 'Room Alpha',
        host: {
          id: 1,
          displayName: 'Host',
        },
        maxPlayers: 8,
        status: 'IN_GAME',
        isPrivate: false,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        players: [
          { id: 1, displayName: 'Host' },
          { id: 2, displayName: 'Player 2' },
          { id: 3, displayName: 'Player 3' },
        ],
        playersCount: 3,
      });
      expect(result).toEqual({
        id: roomId,
        name: 'Room Alpha',
        host: {
          id: 1,
          displayName: 'Host',
        },
        maxPlayers: 8,
        status: 'IN_GAME',
        isPrivate: false,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        players: [
          { id: 1, displayName: 'Host' },
          { id: 2, displayName: 'Player 2' },
          { id: 3, displayName: 'Player 3' },
        ],
        playersCount: 3,
      });
    });

    it('should reject when the room does not exist', async () => {
      queryRawMock.mockResolvedValue([]);

      await expect(roomsService.startRoom(roomId, hostId)).rejects.toThrow(
        NotFoundException,
      );

      expect(roomUpdateMock).not.toHaveBeenCalled();
    });

    it('should reject when the user is not the host', async () => {
      await expect(roomsService.startRoom(roomId, 2)).rejects.toThrow(
        ForbiddenException,
      );

      expect(roomUpdateMock).not.toHaveBeenCalled();
    });

    it('should reject when the room is not WAITING', async () => {
      roomFindUniqueMock.mockResolvedValue({
        id: roomId,
        hostId,
        status: 'IN_GAME',
      });

      await expect(roomsService.startRoom(roomId, hostId)).rejects.toThrow(
        ConflictException,
      );

      expect(roomPlayerCountMock).not.toHaveBeenCalled();
      expect(roomUpdateMock).not.toHaveBeenCalled();
    });

    it('should reject when there are fewer than 3 players', async () => {
      roomPlayerCountMock.mockResolvedValue(2);

      await expect(roomsService.startRoom(roomId, hostId)).rejects.toThrow(
        ConflictException,
      );

      expect(roomUpdateMock).not.toHaveBeenCalled();
    });
  });
  describe('leaveRoom', () => {
    const roomId = '550e8400-e29b-41d4-a716-446655440000';
    const hostId = 10;
    const playerId = 20;

    const updatedRoom = {
      id: roomId,
      name: 'Room Alpha',
      hostId,
      maxPlayers: 8,
      status: 'WAITING',
      players: [
        {
          user: { id: hostId, displayName: 'Host' },
        },
      ],
    };

    beforeEach(() => {
      vi.clearAllMocks();

      queryRawMock.mockResolvedValue([{ id: roomId }]);

      roomPlayerFindUniqueMock.mockResolvedValue({
        roomId,
        userId: playerId,
      });

      roomFindUniqueMock
        .mockResolvedValueOnce({
          id: roomId,
          hostId,
        })
        .mockResolvedValueOnce(updatedRoom);

      roomPlayerDeleteMock.mockResolvedValue({});
      roomPlayerCountMock.mockResolvedValue(1);
      roomDeleteMock.mockResolvedValue({});
      roomUpdateMock.mockResolvedValue({});
    });

    it('should allow a normal player to leave a room', async () => {
      roomPlayerCountMock.mockResolvedValue(2);

      const publishLeftSpy = vi.spyOn(roomEventsPublisher, 'publishPlayerLeft');
      const publishHostChangedSpy = vi.spyOn(
        roomEventsPublisher,
        'publishHostChanged',
      );

      const result = await roomsService.leaveRoom(roomId, playerId);

      expect(publishLeftSpy).toHaveBeenCalledTimes(1);

      expect(publishLeftSpy).toHaveBeenCalledWith({
        roomId,
        playerId,
      });

      expect(publishHostChangedSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        roomDeleted: false,
        room: updatedRoom,
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(queryRawMock).toHaveBeenCalledTimes(1);

      expect(roomPlayerDeleteMock).toHaveBeenCalledWith({
        where: {
          roomId_userId: { roomId, userId: playerId },
        },
      });

      expect(roomUpdateMock).not.toHaveBeenCalled();
      expect(roomDeleteMock).not.toHaveBeenCalled();
    });

    it('should transfer host ownership to the oldest remaining player', async () => {
      const emittedEvents: RoomEvent[] = [];

      const subscription = roomEventsPublisher.events$.subscribe((event) =>
        emittedEvents.push(event),
      );
      const nextHostId = 30;

      roomFindUniqueMock
        .mockReset()
        .mockResolvedValueOnce({
          id: roomId,
          hostId: playerId,
        })
        .mockResolvedValueOnce({
          ...updatedRoom,
          hostId: nextHostId,
        });

      roomPlayerCountMock.mockResolvedValue(2);

      roomPlayerFindFirstMock.mockResolvedValue({
        userId: nextHostId,
      });

      const result = await roomsService.leaveRoom(roomId, playerId);
      expect(emittedEvents).toEqual([
        {
          event: 'room.player_left',
          payload: { roomId, playerId },
        },
        {
          event: 'room.host_changed',
          payload: {
            roomId,
            previousHostId: playerId,
            newHostId: nextHostId,
          },
        },
      ]);
      subscription.unsubscribe();
      expect(result.roomDeleted).toBe(false);

      expect(roomPlayerFindFirstMock).toHaveBeenCalledWith({
        where: { roomId },
        orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        select: { userId: true },
      });

      expect(roomUpdateMock).toHaveBeenCalledWith({
        where: { id: roomId },
        data: { hostId: nextHostId },
      });
    });

    it('should delete the room when the last player leaves', async () => {
      roomPlayerCountMock.mockResolvedValue(0);
      const publishLeftSpy = vi.spyOn(roomEventsPublisher, 'publishPlayerLeft');
      const publishHostChangedSpy = vi.spyOn(
        roomEventsPublisher,
        'publishHostChanged',
      );

      const result = await roomsService.leaveRoom(roomId, playerId);
      expect(publishLeftSpy).toHaveBeenCalledWith({
        roomId,
        playerId,
      });

      expect(publishLeftSpy).toHaveBeenCalledTimes(1);

      expect(publishHostChangedSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        roomDeleted: true,
      });

      expect(roomDeleteMock).toHaveBeenCalledWith({
        where: { id: roomId },
      });

      expect(roomUpdateMock).not.toHaveBeenCalled();
      expect(roomFindUniqueMock).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the room does not exist', async () => {
      queryRawMock.mockResolvedValue([]);

      await expect(roomsService.leaveRoom(roomId, playerId)).rejects.toThrow(
        NotFoundException,
      );

      expect(roomPlayerDeleteMock).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the user is not a member', async () => {
      roomPlayerFindUniqueMock.mockResolvedValue(null);

      await expect(roomsService.leaveRoom(roomId, playerId)).rejects.toThrow(
        NotFoundException,
      );

      expect(roomPlayerDeleteMock).not.toHaveBeenCalled();
      expect(roomFindUniqueMock).not.toHaveBeenCalled();
    });

    it('should throw an error if host transfer has no remaining player', async () => {
      roomFindUniqueMock.mockReset().mockResolvedValueOnce({
        id: roomId,
        hostId: playerId,
      });

      roomPlayerCountMock.mockResolvedValue(1);
      roomPlayerFindFirstMock.mockResolvedValue(null);

      await expect(roomsService.leaveRoom(roomId, playerId)).rejects.toThrow(
        'Host transfer failed: no remaining player found',
      );

      expect(roomUpdateMock).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when Prisma returns P2034', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or deadlock',
        {
          code: 'P2034',
          clientVersion: '7.10.0',
        },
      );

      transactionMock.mockRejectedValue(prismaError);

      await expect(roomsService.leaveRoom(roomId, playerId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ServiceUnavailableException when Prisma returns P2024', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Timed out fetching a new connection from the connection pool',
        {
          code: 'P2024',
          clientVersion: '7.10.0',
        },
      );

      transactionMock.mockRejectedValue(prismaError);

      await expect(roomsService.leaveRoom(roomId, playerId)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
