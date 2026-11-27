import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  HttpException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { PrismaService } from './../prisma/prisma.service.js';
import { generateInviteCode, hashInviteCode } from './invite-code.js';
import { Prisma } from '../generated/prisma/client.js';
import { JoinRoomByCodeDto } from './dto/join-room.dto.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import { GameService } from '../game/game.service.js';
import { GameEventsService } from '../game/game-events.service.js';
import type { GameEvent } from '../game/contracts/game-event.type.js';

@Injectable()
export class RoomsService implements OnModuleInit, OnModuleDestroy {
  private unsubscribeGameEvents?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roomEventPublisher: RoomEventsPublisher,
    private readonly gameService: GameService,
    private readonly gameEventsService: GameEventsService,
  ) {}

  // private handleGamePlayerUpdated(
  //   event: Extract<GameEvent, { name: 'game.player_updated' }>,
  // ): void {
  //   this.roomEventPublisher.publishGamePlayerUpdated({
  //     roomId: event.roomId,
  //     gameId: event.payload.gameId,
  //     userId: event.payload.userId,
  //     ...('participationStatus' in event.payload
  //       ? {
  //           participationStatus: event.payload.participationStatus,
  //         }
  //       : {
  //           connectionStatus: event.payload.connectionStatus,
  //         }),
  //   });
  // }

  // private handleGamePhaseChanged(
  //   event: Extract<GameEvent, { name: 'game.phase_changed' }>,
  // ): void {
  //   this.roomEventPublisher.publishGamePhaseChanged({
  //     roomId: event.roomId,
  //     gameId: event.payload.gameId,
  //     phase: event.payload.phase,
  //     roundNumber: event.payload.roundNumber,
  //     phaseEndsAt: event.payload.phaseEndsAt,
  //   });
  // }

  // private handleGameClueSubmitted(
  //   event: Extract<GameEvent, { name: 'game.clue_submitted' }>,
  // ): void {
  //   this.roomEventPublisher.publishGameClueSubmitted({
  //     roomId: event.roomId,
  //     gameId: event.payload.gameId,
  //     roundNumber: event.payload.roundNumber,
  //     userId: event.payload.userId,
  //     clue: event.payload.clue,
  //   });
  // }

  // private handleGameRoundResolved(
  //   event: Extract<GameEvent, { name: 'game.round_resolved' }>,
  // ): void {
  //   this.roomEventPublisher.publishGameRoundResolved({
  //     roomId: event.roomId,
  //     gameId: event.payload.gameId,
  //     roundNumber: event.payload.roundNumber,
  //     outcome: event.payload.outcome,
  //     eliminatedUserId: event.payload.eliminatedUserId,
  //     eliminatedRole: event.payload.eliminatedRole,
  //   });
  // }

  // onModuleInit(): void {
  //   this.unsubscribeGameEvents = this.gameEventsService.subscribe(
  //     async (event: GameEvent) => {
  //       switch (event.name) {
  //         case 'game.ended':
  //           await this.handleGameEnded(event.payload);
  //           break;

  //         case 'game.player_updated':
  //           this.handleGamePlayerUpdated(event);
  //           break;
  //         case 'game.phase_changed':
  //           this.handleGamePhaseChanged(event);
  //           break;
  //         case 'game.clue_submitted':
  //           this.handleGameClueSubmitted(event);
  //           break;
  //         case 'game.round_resolved':
  //           this.handleGameRoundResolved(event);
  //           break;
  //       }
  //     },
  //   );
  // }


  onModuleInit(): void {
    this.unsubscribeGameEvents = this.gameEventsService.subscribe(
      async (event: GameEvent) => {
        if (event.name === 'game.ended') {
          await this.handleGameEnded(event.payload);
        }
      },
    );
  }


  onModuleDestroy(): void {
    this.unsubscribeGameEvents?.();
  }

  private async handleGameEnded(result: {
    gameId: string;
    roomId: string;
    status: 'FINISHED' | 'TERMINATED';
    winner: 'SPY' | 'DETECTIVES' | null;
    reason: 'SPY_DEPARTED' | 'INSUFFICIENT_PLAYERS' | null;
    endedAt: string;
  }): Promise<void> {
    const update = await this.prisma.room.updateMany({
      where: {
        id: result.roomId,
        status: 'IN_GAME',
      },
      data: {
        status: 'FINISHED',
      },
    });

    // Prevent duplicate notifications if the room was already finished.
    if (update.count !== 1) {
      return;
    }

    this.roomEventPublisher.publishRoomFinished({
      roomId: result.roomId,
      gameId: result.gameId,
      status: result.status,
      winner: result.winner,
      reason: result.reason,
      endedAt: result.endedAt,
    });
  }

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
      maxPlayers: dto.maxPlayers,
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
      // 1. Validate the room and reserve it for starting.
      const reservedRoom = await this.prisma.$transaction(async (tx) => {
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

        if (playersCount > 8) {
          throw new ConflictException('A maximum of 8 players is allowed');
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

      // 2. Start the actual game through M1, outside the room transaction.
      const participantIds = reservedRoom.players.map((player) => player.id);

      let game;

      try {
        game = await this.gameService.startGame({
          roomId,
          participantIds,
        });
      } catch (error) {
        // 3. Check whether M1 created the game despite the error.
        const existingGame = await this.prisma.game.findUnique({
          where: { roomId },
          select: { id: true },
        });

        // Only restore WAITING if no game was created.
        if (!existingGame) {
          await this.prisma.room.updateMany({
            where: {
              id: roomId,
              status: 'IN_GAME',
            },
            data: {
              status: 'WAITING',
            },
          });
        }

        throw error;
      }

      // 4. Notify connected lobby players that the game started.
      this.roomEventPublisher.publishGameStarted({
        roomId,
        gameId: game.gameId,
        phase: game.phase,
        roundNumber: game.roundNumber,
        phaseEndsAt: game.phaseEndsAt,
      });

      // 5. Return room information and the host.
      return {
        ...reservedRoom,
        game,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new ConflictException('Game already exists for this room');

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
      // 1. Récupérer l'état de la room et sa partie éventuelle
      const initialRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          status: true,
          game: {
            select: { id: true },
          },
        },
      });

      if (!initialRoom) {
        throw new NotFoundException('Room not found');
      }

      // 2. Si une partie est en cours, signaler le départ à M1
      if (initialRoom.status === 'IN_GAME') {
        if (!initialRoom.game) {
          throw new ConflictException('Game is starting. Please retry.');
        }

        const membership = await this.prisma.roomPlayer.findUnique({
          where: {
            roomId_userId: { roomId, userId },
          },
        });

        if (!membership) {
          throw new NotFoundException('Player is not a member of this room');
        }

        try {
          await this.gameService.leaveGame(initialRoom.game.id, userId);
        } catch (error: unknown) {
          // La partie a éventuellement terminé entre-temps.
          const currentRoom = await this.prisma.room.findUnique({
            where: { id: roomId },
            select: { status: true },
          });

          if (currentRoom?.status !== 'FINISHED') {
            throw error;
          }
        }
      }

      // 3. Supprimer le membre de la room et gérer le host
      const result = await this.prisma.$transaction(async (tx) => {
        const lockedRoom = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE
      `;

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
          where: { id: roomId },
          select: {
            id: true,
            hostId: true,
            status: true,
            game: {
              select: { id: true },
            },
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
          where: { roomId },
        });

        // Supprimer uniquement une room sans partie associée.
        if (playersCount === 0 && !room.game) {
          await tx.room.delete({
            where: { id: roomId },
          });

          return {
            roomDeleted: true as const,
            previousHostId,
            newHostId: null,
          };
        }

        // Transférer le rôle du host si nécessaire.
        if (room.hostId === userId && playersCount > 0) {
          const nextHost = await tx.roomPlayer.findFirst({
            where: { roomId },
            orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
            select: { userId: true },
          });

          if (!nextHost) {
            throw new Error('Host transfer failed: no remaining player found');
          }

          await tx.room.update({
            where: { id: roomId },
            data: { hostId: nextHost.userId },
          });

          newHostId = nextHost.userId;
        }

        const updatedRoom = await tx.room.findUnique({
          where: { id: roomId },
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
              orderBy: { joinedAt: 'asc' },
            },
          },
        });

        return {
          roomDeleted: false as const,
          room: updatedRoom,
          previousHostId,
          newHostId,
        };
      });

      // 4. Publier les événements M4
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

  async verifyPlayerMembership(roomId: string, userId: number): Promise<void> {
    const membership = await this.prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }
  }
}
