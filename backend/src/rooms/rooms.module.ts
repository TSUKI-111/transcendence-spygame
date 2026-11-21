import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import { RoomGateway } from './room.gateway.js';
import { ChatService } from './chat/chat.service.js';
import { ChatGateway } from './chat/chat.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
@Module({
  imports: [AuthModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomEventsPublisher,
    RoomGateway,
    ChatService,
    ChatGateway,
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
