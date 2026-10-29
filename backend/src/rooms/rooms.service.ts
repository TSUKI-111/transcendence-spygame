import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { PrismaService } from './../prisma/prisma.service.js';
import { generateInviteCode, hashInviteCode } from './invite-code.js';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(dto: CreateRoomDto, userId: number) {
    const member = await this.prisma.roomPlayer.findUnique({
      where: { userId },
      select: {
        room: {
          select: {
            status: true,
          }
        }
      }
    });
    if(member && (member.room.status === 'WAITING' || member.room.status === 'IN_GAME'))
    {
      throw new ConflictException('You are already a member of an active room');
    }
    let code: string | undefined;
    let hash: string | undefined;
    if(dto.is_private === true){
      code = generateInviteCode();
      hash = hashInviteCode(code);
    }

    const data = {
      name: dto.name,
      maxPlayers: dto.max_players,
      isPrivate: dto.is_private,
      hostId: userId,
      inviteCode: hash ?? null,
      players: {create: {userId}},
    };

    const room = await this.prisma.room.create({data: data});
    const {inviteCode: _hash, ...roomWithoutHash} = room;
    if(code !== undefined)
    {
      return {
        room: roomWithoutHash,
        inviteCode: code
      };
    }
    return {room: roomWithoutHash};
  }

  async findAll() {
    const rooms = await this.prisma.room.findMany({
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

    return rooms.map(({ players, ...room }) => ({
      ...room,
      playersCount: players.length,
    }));
  }

  async findOne(id: string, userId: number) {
    const room = await this.prisma.room.findUnique({
      where: { id },
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
        },
        maxPlayers: true,
        status: true,
        isPrivate: true,
        createdAt: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.isPrivate) {
      const membership = await this.prisma.roomPlayer.findUnique({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this private room',
        );
      }
    }

    const players = room.players.map(({ user }) => user);

    return {
      ...room,
      players,
      playersCount: players.length,
    };
  }
}
