import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { ChatChannel } from '../../generated/prisma/client.js';

describe('ChatGateway', () => {
  const roomId = '00000000-0000-4000-8000-000000000001';

  const message = {
    id: 1,
    roomId,
    userId: 7,
    username: 'marouan',
    displayName: 'Marouan',
    content: 'Hello',
    channel: ChatChannel.LOBBY,
    createdAt: new Date('2026-11-24T10:00:00.000Z'),
  };

  const chatService = {
    sendMessage: vi.fn(),
    getMessageHistory: vi.fn(),
  };

  const client = {
    data: {
      user: { id: 7 },
    },
    emit: vi.fn(),
  };

  const roomEmitter = {
    emit: vi.fn(),
  };

  const server = {
    to: vi.fn().mockReturnValue(roomEmitter),
  };

  let gateway: ChatGateway;

  beforeEach(() => {
    vi.clearAllMocks();

    chatService.sendMessage.mockResolvedValue(message);
    chatService.getMessageHistory.mockResolvedValue([message]);

    gateway = new ChatGateway(chatService as unknown as ChatService);

    gateway.server = server as never;
  });

  describe('handleSendMessage', () => {
    it('should send a message and broadcast it to the room', async () => {
      await gateway.handleSendMessage(
        { roomId, content: 'Hello' },
        client as never,
      );

      expect(chatService.sendMessage).toHaveBeenCalledWith(roomId, 7, 'Hello');

      expect(server.to).toHaveBeenCalledWith(roomId);

      expect(roomEmitter.emit).toHaveBeenCalledWith('chat.message', message);

      expect(client.emit).not.toHaveBeenCalled();
    });

    it('should emit ROOM_NOT_FOUND when the room does not exist', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new NotFoundException('Room not found'),
      );

      await gateway.handleSendMessage(
        { roomId, content: 'Hello' },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      });

      expect(roomEmitter.emit).not.toHaveBeenCalled();
    });

    it('should emit ROOM_ACCESS_DENIED when the user is not a member', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new ForbiddenException('You are not a member of this room'),
      );

      await gateway.handleSendMessage(
        { roomId, content: 'Hello' },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'ROOM_ACCESS_DENIED',
        message: 'You are not a member of this room',
      });

      expect(roomEmitter.emit).not.toHaveBeenCalled();
    });

    it('should emit CHAT_NOT_AVAILABLE outside the discussion phase', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new ForbiddenException('Chat is not available during this game phase'),
      );

      await gateway.handleSendMessage(
        { roomId, content: 'Hello' },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'CHAT_NOT_AVAILABLE',
        message: 'Chat is not available during this game phase',
      });
    });

    it('should emit MESSAGE_EMPTY for an empty message', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new ConflictException('Message cannot be empty'),
      );

      await gateway.handleSendMessage({ roomId, content: '' }, client as never);

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'MESSAGE_EMPTY',
        message: 'Message cannot be empty',
      });
    });

    it('should emit MESSAGE_TOO_LONG for a message over 300 characters', async () => {
      chatService.sendMessage.mockRejectedValueOnce(
        new ConflictException('Message cannot exceed 300 characters'),
      );

      await gateway.handleSendMessage(
        { roomId, content: 'a'.repeat(301) },
        client as never,
      );

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message cannot exceed 300 characters',
      });
    });

    it('should reject a socket without an authenticated user', async () => {
      const unauthenticatedClient = {
        data: {},
        emit: vi.fn(),
      };

      await gateway.handleSendMessage(
        { roomId, content: 'Hello' },
        unauthenticatedClient as never,
      );

      expect(chatService.sendMessage).not.toHaveBeenCalled();

      expect(unauthenticatedClient.emit).toHaveBeenCalledWith(
        'chat.error',
        expect.objectContaining({
          code: 'ROOM_ACCESS_DENIED',
        }),
      );
    });
  });

  describe('handleGetHistory', () => {
    it('should send chat history to the requesting client', async () => {
      await gateway.handleGetHistory({ roomId }, client as never);

      expect(chatService.getMessageHistory).toHaveBeenCalledWith(roomId, 7);

      expect(client.emit).toHaveBeenCalledWith('chat.history', {
        roomId,
        messages: [message],
      });
    });

    it('should emit an error when history access is denied', async () => {
      chatService.getMessageHistory.mockRejectedValueOnce(
        new ForbiddenException('You are not a member of this room'),
      );

      await gateway.handleGetHistory({ roomId }, client as never);

      expect(client.emit).toHaveBeenCalledWith('chat.error', {
        code: 'ROOM_ACCESS_DENIED',
        message: 'You are not a member of this room',
      });
    });
  });
});
