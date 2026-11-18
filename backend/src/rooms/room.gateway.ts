import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';

import type { Server, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';

import { RoomEventsPublisher } from './events/room-events.publisher.js';
import { RoomsService } from './rooms.service.js';
import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JoinSocketRoomDto } from './dto/join-socket-room.dto.js';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayInit, OnModuleDestroy {
  private subscription?: Subscription;

  constructor(
    private readonly roomEventsPublisher: RoomEventsPublisher,
    private readonly roomsService: RoomsService,
  ) {}

  afterInit(server: Server): void {
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
    // TODO M2: récupérer l'identité authentifiée.
    // const userId = client.data.user.id;
    // TODO: vérifier l'appartenance avec RoomsService.
    // await this.roomsService.verifyPlayerMembership(dto.roomId, userId);
    // TODO: rejoindre le salon uniquement après authentification.
    // await client.join(dto.roomId);
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
