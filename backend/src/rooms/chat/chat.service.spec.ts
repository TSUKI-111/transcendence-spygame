import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ChatChannel,
  GamePhase,
  RoomStatus,
} from '../../generated/prisma/client.js';

describe('ChatService', () => {
  const roomId = '00000000-0000-4000-8000-000000000001';
  const userId = 7;
  const createdAt = new Date('2026-11-24T10:00:00.000Z');

  const prisma = {
    room: {
      findUnique: vi.fn(),
    },
    roomPlayer: {
      findUnique: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };

  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService(prisma as unknown as PrismaService);
  });

  function mockMembership() {
    prisma.room.findUnique.mockResolvedValueOnce({ id: roomId });
    prisma.roomPlayer.findUnique.mockResolvedValueOnce({ userId });
  }

  function mockMessageCreation(channel: ChatChannel) {
    prisma.chatMessage.create.mockResolvedValue({
      id: 1,
      roomId,
      userId,
      channel,
      content: 'Hello everyone',
      createdAt,
      user: {
        username: 'marouan',
        displayName: 'Marouan',
      },
    });
  }

  describe('sendMessage', () => {
    it('should send a lobby message when the room is waiting', async () => {
      mockMembership();

      prisma.room.findUnique.mockResolvedValueOnce({
        status: RoomStatus.WAITING,
        game: null,
      });

      mockMessageCreation(ChatChannel.LOBBY);

      const result = await service.sendMessage(
        roomId,
        userId,
        '  Hello everyone  ',
      );

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          roomId,
          userId,
          content: 'Hello everyone',
          channel: ChatChannel.LOBBY,
        },
        select: expect.any(Object),
      });

      expect(result).toEqual({
        id: 1,
        roomId,
        userId,
        username: 'marouan',
        displayName: 'Marouan',
        content: 'Hello everyone',
        channel: ChatChannel.LOBBY,
        createdAt,
      });
    });

    it('should send a discussion message during the discussion phase', async () => {
      mockMembership();

      prisma.room.findUnique.mockResolvedValueOnce({
        status: RoomStatus.IN_GAME,
        game: { phase: GamePhase.DISCUSSION },
      });

      mockMessageCreation(ChatChannel.DISCUSSION);

      const result = await service.sendMessage(
        roomId,
        userId,
        'Hello everyone',
      );

      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: ChatChannel.DISCUSSION,
          }),
        }),
      );

      expect(result.channel).toBe(ChatChannel.DISCUSSION);
    });

    it('should reject a message if the room does not exist', async () => {
      prisma.room.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.sendMessage(roomId, userId, 'Hello'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.roomPlayer.findUnique).not.toHaveBeenCalled();
    });

    it('should reject a message from a non-member', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({ id: roomId });
      prisma.roomPlayer.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.sendMessage(roomId, userId, 'Hello'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should reject an empty message', async () => {
      mockMembership();

      await expect(service.sendMessage(roomId, userId, '   ')).rejects.toThrow(
        ConflictException,
      );

      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should reject a message longer than 300 characters', async () => {
      mockMembership();

      await expect(
        service.sendMessage(roomId, userId, 'a'.repeat(301)),
      ).rejects.toThrow(ConflictException);

      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('should reject messages outside the allowed game phase', async () => {
      mockMembership();

      prisma.room.findUnique.mockResolvedValueOnce({
        status: RoomStatus.IN_GAME,
        game: { phase: GamePhase.CLUE_SUBMISSION },
      });

      await expect(
        service.sendMessage(roomId, userId, 'Hello'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('getMessageHistory', () => {
    it('should reject history access from a non-member', async () => {
      prisma.room.findUnique.mockResolvedValueOnce({ id: roomId });
      prisma.roomPlayer.findUnique.mockResolvedValueOnce(null);

      await expect(service.getMessageHistory(roomId, userId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });

    it('should return the latest 50 messages in chronological order', async () => {
      mockMembership();

      const olderMessage = {
        id: 1,
        roomId,
        userId,
        content: 'First message',
        channel: ChatChannel.LOBBY,
        createdAt: new Date('2026-11-24T09:00:00.000Z'),
        user: {
          username: 'user1',
          displayName: 'User One',
        },
      };

      const newerMessage = {
        id: 2,
        roomId,
        userId,
        content: 'Second message',
        channel: ChatChannel.LOBBY,
        createdAt: new Date('2026-11-24T10:00:00.000Z'),
        user: {
          username: 'user2',
          displayName: 'User Two',
        },
      };

      // Prisma returns newest first because of orderBy: desc.
      prisma.chatMessage.findMany.mockResolvedValue([
        newerMessage,
        olderMessage,
      ]);

      const result = await service.getMessageHistory(roomId, userId);

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First message');
      expect(result[1].content).toBe('Second message');
      expect(result[0].username).toBe('user1');
      expect(result[1].username).toBe('user2');
    });
  });
});
