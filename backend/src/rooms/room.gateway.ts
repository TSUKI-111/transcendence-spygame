import { ForbiddenException, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';

import type { Server, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';

import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { WsSessionAuthService } from '../auth/ws-session-auth.service.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import { JoinSocketRoomDto } from './dto/join-socket-room.dto.js';
import { RoomsService } from './rooms.service.js';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_ORIGIN,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayInit, OnModuleDestroy {
  private subscription?: Subscription;

  constructor(
    private readonly roomEventsPublisher: RoomEventsPublisher,
    private readonly roomsService: RoomsService,
    private readonly wsAuth: WsSessionAuthService,
  ) {}

  afterInit(server: Server): void {
    // M2: authenticate every Socket.IO connection using its session cookie.
    server.use((socket, next) => {
      void this.wsAuth.authenticate(socket).then(
        () => next(),
        () => next(new Error('Connexion non autorisée')),
      );
    });

    // M1/M4: broadcast room events to connected members.
    this.subscription = this.roomEventsPublisher.events$.subscribe(
      ({ event, payload }) => {
        server.to(payload.roomId).emit(event, payload);
      },
    );
  }

  @SubscribeMessage('room.join')
  async handleJoinRoom(
    @MessageBody() dto: JoinSocketRoomDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // The user identity comes exclusively from the authenticated session.
    const user = (client.data as { user?: AuthenticatedUser }).user;

    if (!user || !Number.isInteger(user.id)) {
      throw new WsException('Connexion requise');
    }

    // M4: only room members are allowed to join the Socket.IO room.
    try {
      await this.roomsService.verifyPlayerMembership(dto.roomId, user.id);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new WsException('Accès refusé à cette room');
      }

      throw error;
    }

    await client.join(dto.roomId);
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
