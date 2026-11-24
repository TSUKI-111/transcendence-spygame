import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ChatChannel,
  GamePhase,
  RoomStatus,
} from '../../generated/prisma/client.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}
  async sendMessage(roomId: string, userId: number, content: string) {
    await this.verifyMembership(roomId, userId);
    const whatInContent = content.trim();
    if (!whatInContent) {
      throw new ConflictException('Message cannot be empty');
    }
    if (whatInContent.length > 300) {
      throw new ConflictException('Message cannot exceed 300 characters');
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        status: true,
        game: {
          select: {
            phase: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }
    let channel: ChatChannel;

    if (room.status === RoomStatus.WAITING) {
      channel = ChatChannel.LOBBY;
    } else if (
      room.status === RoomStatus.IN_GAME &&
      room.game?.phase === GamePhase.DISCUSSION
    ) {
      channel = ChatChannel.DISCUSSION;
    } else {
      throw new ForbiddenException(
        'Chat is not available during this game phase',
      );
    }
    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        content: whatInContent,
        channel,
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        channel: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });
    return {
      id: message.id,
      roomId: message.roomId,
      userId: message.userId,
      username: message.user.username,
      displayName: message.user.displayName,
      content: message.content,
      channel: message.channel,
      createdAt: message.createdAt,
    };
  }
  private async verifyMembership(roomId: string, userId: number) {
    const room = await this.prisma.room.findUnique({
      where: {
        id: roomId,
      },
      select: {
        id: true,
      },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const memberShip = await this.prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      select: {
        userId: true,
      },
    });
    if (!memberShip) {
      throw new ForbiddenException('You are not a member of this room');
    }
  }
  async getMessageHistory(roomId: string, userId: number) {
    await this.verifyMembership(roomId, userId);
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        roomId: true,
        userId: true,
        content: true,
        channel: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });
    return messages.reverse().map((message) => ({
      id: message.id,
      roomId: message.roomId,
      userId: message.userId,
      username: message.user.username,
      displayName: message.user.displayName,
      channel: message.channel,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }
}
