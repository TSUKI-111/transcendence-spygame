import {Body, Controller, Get, Post, Param, ParseUUIDPipe, Req, UseGuards} from '@nestjs/common';
import {ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiBadRequestResponse, ApiConflictResponse} from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { RoomsService } from './rooms.service.js';
import { RequireUserGuard } from '../auth/guards/require-user.guard.js';
import type { RequestWithUser } from '../auth/types/request-with-user.type.js';
import { RoomListResponseDto } from './dto/room-list-response.dto.js';
import { RoomDetailsResponseDto } from './dto/room-details-response.dto.js';
import { CreatedRoomResponseDto } from './dto/create-room-response.dto.js';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(RequireUserGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a room' })
  @ApiCreatedResponse({
    description:
      'Room created. A private room returns its invitation code only in this response.',
    type: CreatedRoomResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid room data.' })
  @ApiConflictResponse({
    description: 'The authenticated user already belongs to an active room.',
  })
  async create(
    @Body() dto: CreateRoomDto,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.createRoom(dto, req.user!.id);
  }

  @Get()
  @ApiOperation({ summary: 'List public rooms waiting for players' })
  @ApiOkResponse({
    description:
      'Returns public rooms in WAITING status. Invitation codes are not included.',
    type: RoomListResponseDto,
    isArray: true,
  })
  async findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details' })
  @ApiOkResponse({
    description:
      'Returns room details, including players, without an invitation code. Private rooms are visible to members only.',
    type: RoomDetailsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Room ID is not a valid UUID.' })
  @ApiForbiddenResponse({
    description: 'The user is not a member of the private room.',
  })
  @ApiNotFoundResponse({ description: 'Room not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.findOne(id, req.user!.id);
  }
}