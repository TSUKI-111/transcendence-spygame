import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return {
      message: 'Rooms endpoint scaffold created',
      received: dto,
    };
  }

  @Get()
  findAll() {
    return {
      message: 'Rooms list endpoint scaffold created',
      rooms: [],
    };
  }
}
