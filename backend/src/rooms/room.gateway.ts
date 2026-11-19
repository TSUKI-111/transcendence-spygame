import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';

import type { Server } from 'socket.io';
import type { Subscription } from 'rxjs';

import { RoomEventsPublisher } from './events/room-events.publisher.js';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayInit, OnModuleDestroy {
  private subscription?: Subscription;

  constructor(private readonly roomEventsPublisher: RoomEventsPublisher) {}

  afterInit(server: Server): void {
    this.subscription = this.roomEventsPublisher.events$.subscribe(
      ({ event, payload }) => {
        server.to(payload.roomId).emit(event, payload);
      },
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
