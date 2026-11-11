import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import { RoomGateway } from './room.gateway.js';
@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomEventsPublisher, RoomGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
