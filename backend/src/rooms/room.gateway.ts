import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';

import type { Server } from 'socket.io';
import type { Subscription } from 'rxjs';

import { WsSessionAuthService } from '../auth/ws-session-auth.service.js'; //j'ai ajouter cet Importe de service d’authentification WebSocket
import { RoomEventsPublisher } from './events/room-events.publisher.js';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_ORIGIN,
    // j'ai changer la limite des origine autorise , utilise maintenant l’origine définie dans mon environnement : APP_ORIGIN=https://localhost:8443
    credentials: true,
  },
})
export class RoomGateway implements OnGatewayInit, OnModuleDestroy {
  private subscription?: Subscription;

  constructor(
    private readonly roomEventsPublisher: RoomEventsPublisher,
    private readonly wsAuth: WsSessionAuthService, // j'ai Injecter le service dans le constructeur
  ) {}

  // j'ajouter cet middleware de conexion
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.wsAuth.authenticate(socket).then(
        () => next(),
        () => next(new Error('Connexion non autorisée')),
      );
    });

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