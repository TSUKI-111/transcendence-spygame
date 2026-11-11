import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { PrismaService } from './../prisma/prisma.service.js';
import { generateInviteCode, hashInviteCode } from './invite-code.js';
import { Prisma } from '../generated/prisma/client.js';
import { JoinRoomByCodeDto } from './dto/join-room.dto.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomEventPublisher: RoomEventsPublisher,
  ) {}

  async createRoom(dto: CreateRoomDto, userId: number) {
    const member = await this.prisma.roomPlayer.findUnique({
      where: { userId },
      select: {
        room: {
          select: {
            status: true,
          },
        },
      },
    });
    if (
      member &&
      (member.room.status === 'WAITING' || member.room.status === 'IN_GAME')
    ) {
      throw new ConflictException('You are already a member of an active room');
    }
    let code: string | undefined;
    let hash: string | undefined;
    if (dto.is_private === true) {
      code = generateInviteCode();
      hash = hashInviteCode(code);
    }

    const data = {
      name: dto.name,
      maxPlayers: dto.max_players,
      isPrivate: dto.is_private,
      hostId: userId,
      inviteCode: hash ?? null,
      players: { create: { userId } },
    };

    const room = await this.prisma.room.create({ data: data });
    const { inviteCode: _hash, ...roomWithoutHash } = room;
    if (code !== undefined) {
      return {
        room: roomWithoutHash,
        inviteCode: code,
      };
    }
    return { room: roomWithoutHash };
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

  async joinRoom(roomId: string, userId: number) {
    try {
      const updateRoom = await this.prisma.$transaction(async (tx) => {
        const lockedRoom = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;

        if (lockedRoom.length === 0) {
          throw new NotFoundException('Room not found');
        }

        const room = await tx.room.findUnique({
          where: {
            id: roomId,
          },
        });

        if (!room) {
          throw new NotFoundException('Room not found');
        }

        if (room.isPrivate) {
          throw new NotFoundException('Room not found');
        }

        if (room.status !== 'WAITING') {
          throw new ConflictException('Room is not accepting players');
        }

        const existingMembership = await tx.roomPlayer.findUnique({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        if (existingMembership) {
          throw new ConflictException('You are already a member of this room');
        }

        const userMembership = await tx.roomPlayer.findUnique({
          where: {
            userId: userId,
          },
        });

        if (userMembership) {
          throw new ConflictException(
            'You already belong to another active room',
          );
        }

        const playersCount = await tx.roomPlayer.count({
          where: {
            roomId: roomId,
          },
        });

        if (playersCount >= room.maxPlayers) {
          throw new ConflictException('Room is full');
        }

        await tx.roomPlayer.create({
          data: {
            userId: userId,
            roomId: roomId,
          },
        });

        const updateRoom = await tx.room.findUnique({
          where: {
            id: roomId,
          },
          include: {
            players: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        });

        return updateRoom;
      });
      if (updateRoom) {
        const joinedPlayer = updateRoom.players.find(
          ({ user }) => user.id === userId,
        );
        if (joinedPlayer) {
          this.roomEventPublisher.publishPlayerJoined({
            roomId,
            player: joinedPlayer.user,
          });
        }
      }
      return updateRoom;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new ConflictException(
              'User already belongs to an active room',
            );
          case 'P2003':
            throw error;
          case 'P2025':
            throw error;
          case 'P2034':
            throw new ConflictException(
              'Concurrent operation detected. Please retry.',
            );
          case 'P2024':
            throw new ServiceUnavailableException(
              'Database temporarily unavailable',
            );
          default:
            throw error;
        }
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        if (error.errorCode === 'P1001' || error.errorCode === 'P1002') {
          throw new ServiceUnavailableException(
            'Database temporarily unavailable',
          );
        }
        throw error;
      }
      throw error;
    }
  }
  async joinByInviteCode(dtoCode: JoinRoomByCodeDto, userId: number) {
    try {
      const hash = hashInviteCode(dtoCode.inviteCode);
      const updateRoom = await this.prisma.$transaction(async (tx) => {
        const lockedRooms = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM rooms WHERE inviteCode = ${hash} FOR UPDATE`;

        if (lockedRooms.length === 0) {
          throw new NotFoundException('Room not found');
        }

        const lockedRoom = lockedRooms[0];

        const room = await tx.room.findUnique({
          where: {
            id: lockedRoom.id,
          },
        });

        if (!room) {
          throw new NotFoundException('Room not found');
        }

        if (!room.isPrivate) {
          throw new NotFoundException('Room not found');
        }

        if (room.status !== 'WAITING') {
          throw new ConflictException('Room is not accepting players');
        }

        const existingMembership = await tx.roomPlayer.findUnique({
          where: {
            roomId_userId: { roomId: room.id, userId },
          },
        });

        if (existingMembership) {
          throw new ConflictException('You are already a member of this room');
        }

        const userMembership = await tx.roomPlayer.findUnique({
          where: {
            userId: userId,
          },
        });

        if (userMembership) {
          throw new ConflictException(
            'You already belong to another active room',
          );
        }

        const playersCount = await tx.roomPlayer.count({
          where: {
            roomId: room.id,
          },
        });

        if (playersCount >= room.maxPlayers) {
          throw new ConflictException('Room is full');
        }

        await tx.roomPlayer.create({
          data: {
            userId: userId,
            roomId: room.id,
          },
        });

        const updateRoom = await tx.room.findUnique({
          where: {
            id: room.id,
          },
          include: {
            players: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        });

        return updateRoom;
      });
      if (updateRoom) {
        const joinedPlayer = updateRoom.players.find(
          ({ user }) => user.id === userId,
        );

        if (joinedPlayer) {
          this.roomEventPublisher.publishPlayerJoined({
            roomId: updateRoom.id,
            player: joinedPlayer.user,
          });
        }
      }

      return updateRoom;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new ConflictException(
              'User already belongs to an active room',
            );
          case 'P2003':
            throw error;
          case 'P2025':
            throw error;
          case 'P2034':
            throw new ConflictException(
              'Concurrent operation detected. Please retry.',
            );
          case 'P2024':
            throw new ServiceUnavailableException(
              'Database temporarily unavailable',
            );
          default:
            throw error;
        }
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        if (error.errorCode === 'P1001' || error.errorCode === 'P1002') {
          throw new ServiceUnavailableException(
            'Database temporarily unavailable',
          );
        }
        throw error;
      }
      throw error;
    }
  }
  async startRoom(roomId: string, userId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockedRoom = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE
        `;

        if (lockedRoom.length === 0) {
          throw new NotFoundException('Room not found');
        }

        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: {
            id: true,
            hostId: true,
            status: true,
            maxPlayers: true,
          },
        });

        if (!room) {
          throw new NotFoundException('Room not found');
        }

        if (room.hostId !== userId) {
          throw new ForbiddenException('Only the room host can start the game');
        }

        if (room.status !== 'WAITING') {
          throw new ConflictException('Room is not in WAITING status');
        }

        const playersCount = await tx.roomPlayer.count({
          where: { roomId },
        });

        if (playersCount < 3) {
          throw new ConflictException(
            'At least 3 players are required to start the game',
          );
        }

        const startedRoom = await tx.room.update({
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

        const players = startedRoom.players.map(({ user }) => user);

        return {
          ...startedRoom,
          players,
          playersCount: players.length,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2034':
            throw new ConflictException(
              'Concurrent room modification. Please retry.',
            );

          case 'P2024':
            throw new ServiceUnavailableException(
              'Database temporarily unavailable',
            );

          default:
            throw error;
        }
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        if (error.errorCode === 'P1001' || error.errorCode === 'P1002') {
          throw new ServiceUnavailableException(
            'Database temporarily unavailable',
          );
        }
        throw error;
      }

      throw error;
    }
  }
  async leaveRoom(roomId: string, userId: number) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const lockedRoom = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;

        if (lockedRoom.length === 0) {
          throw new NotFoundException('Room not found');
        }

        const existingMembership = await tx.roomPlayer.findUnique({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        if (!existingMembership) {
          throw new NotFoundException('Player is not a member of this room');
        }

        const room = await tx.room.findUnique({
          where: {
            id: roomId,
          },
          select: {
            id: true,
            hostId: true,
          },
        });

        if (!room) {
          throw new NotFoundException('Room not found');
        }

        const previousHostId = room.hostId;
        let newHostId: number | null = null;

        await tx.roomPlayer.delete({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        const playersCount = await tx.roomPlayer.count({
          where: {
            roomId: roomId,
          },
        });

        if (playersCount === 0) {
          await tx.room.delete({
            where: { id: roomId },
          });
          return {
            roomDeleted: true as const,
            previousHostId,
            newHostId: null,
          };
        }

        if (room.hostId === userId) {
          const nextHost = await tx.roomPlayer.findFirst({
            where: { roomId: roomId },
            orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
            select: { userId: true },
          });

          if (!nextHost) {
            throw new Error('Host transfer failed: no remaining player found');
          }
          await tx.room.update({
            where: { id: roomId },
            data: {
              hostId: nextHost.userId,
            },
          });
          newHostId = nextHost.userId;
        }
        const updateRoom = await tx.room.findUnique({
          where: {
            id: roomId,
          },
          include: {
            players: {
              include: {
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
          },
        });

        return {
          roomDeleted: false as const,
          room: updateRoom,
          previousHostId,
          newHostId,
        };
      });
      this.roomEventPublisher.publishPlayerLeft({
        roomId,
        playerId: userId,
      });

      if (
        result.newHostId !== null &&
        result.newHostId !== result.previousHostId
      ) {
        this.roomEventPublisher.publishHostChanged({
          roomId,
          previousHostId: result.previousHostId,
          newHostId: result.newHostId,
        });
      }

      if (result.roomDeleted) {
        return { roomDeleted: true as const };
      }

      return {
        roomDeleted: false as const,
        room: result.room,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2034':
            throw new ConflictException(
              'Concurrent room modification, please retry',
            );
          case 'P2024':
            throw new ServiceUnavailableException(
              'Database temporarily unavailable',
            );
          default:
            throw error;
        }
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        if (error.errorCode === 'P1001' || error.errorCode === 'P1002') {
          throw new ServiceUnavailableException(
            'Database temporarily unavailable',
          );
        }
        throw error;
      }
      throw error;
    }
  }
}
