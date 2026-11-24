import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import {
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { OnGatewayInit } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service.js';
import type { SendMessageDto } from './dto/send-message.dto.js';
import type {
  ChatMessagePayload,
  ChatErrorPayload,
  ChatHistoryPayload,
} from './chat.types.js';
import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatWsExceptionFilter } from './filters/chat-ws-exception.filter.js';
import { WsException } from '@nestjs/websockets';
import type { GetHistoryDto } from './dto/get-history.dto.js';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server): void {
    this.logger.log('ChatGateway initialized');
  }

  private getAuthenticatedUserId(client: Socket): number {
    const user = client.data.user as { id?: unknown } | undefined;

    if (typeof user?.id !== 'number' || !Number.isInteger(user.id)) {
      throw new ForbiddenException('Authentication required');
    }

    return user.id;
  }

  @UseFilters(ChatWsExceptionFilter)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () => new WsException('Invalid message data'),
    }),
  )
  @SubscribeMessage('chat.send_message')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(client);

      const message = await this.chatService.sendMessage(
        dto.roomId,
        userId,
        dto.content,
      );

      this.broadcastMessage(message);
    } catch (exception: unknown) {
      const error = this.mapExceptionToChatError(exception);
      client.emit('chat.error', error);
    }
  }

  private broadcastMessage(message: ChatMessagePayload): void {
    this.server.to(message.roomId).emit('chat.message', message);
  }

  private mapExceptionToChatError(exception: unknown): ChatErrorPayload {
    if (exception instanceof NotFoundException) {
      return {
        code: 'ROOM_NOT_FOUND',
        message: 'Room not found',
      };
    }

    if (exception instanceof ForbiddenException) {
      const message = exception.message.toLowerCase();

      if (message.includes('chat is not available')) {
        return {
          code: 'CHAT_NOT_AVAILABLE',
          message: 'Chat is not available during this game phase',
        };
      }

      return {
        code: 'ROOM_ACCESS_DENIED',
        message: 'You are not a member of this room',
      };
    }

    if (exception instanceof ConflictException) {
      const message = exception.message.toLowerCase();

      if (message.includes('cannot exceed')) {
        return {
          code: 'MESSAGE_TOO_LONG',
          message: 'Message cannot exceed 300 characters',
        };
      }

      if (message.includes('cannot be empty')) {
        return {
          code: 'MESSAGE_EMPTY',
          message: 'Message cannot be empty',
        };
      }
    }

    if (exception instanceof BadRequestException) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid message data',
      };
    }

    this.logger.error(
      'Unexpected error in ChatGateway',
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  @UseFilters(ChatWsExceptionFilter)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () => new WsException('Invalid history request'),
    }),
  )
  @SubscribeMessage('chat.get_history')
  async handleGetHistory(
    @MessageBody() dto: GetHistoryDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const userId = this.getAuthenticatedUserId(client);

      const messages = await this.chatService.getMessageHistory(
        dto.roomId,
        userId,
      );

      const history: ChatHistoryPayload = {
        roomId: dto.roomId,
        messages,
      };

      client.emit('chat.history', history);
    } catch (exception: unknown) {
      const error = this.mapExceptionToChatError(exception);
      client.emit('chat.error', error);
    }
  }
}
