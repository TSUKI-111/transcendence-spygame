import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { RoomsService } from './rooms.service.js';
import { RequireUserGuard } from '../auth/guards/require-user.guard.js';
import type { RequestWithUser } from '../auth/types/request-with-user.type.js';
import { RoomListResponseDto } from './dto/room-list-response.dto.js';
import { RoomDetailsResponseDto } from './dto/room-details-response.dto.js';
import { CreatedRoomResponseDto } from './dto/create-room-response.dto.js';
import { JoinRoomByCodeDto } from './dto/join-room.dto.js';
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
  async create(@Body() dto: CreateRoomDto, @Req() req: RequestWithUser) {
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

  @Post(':id/join')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a public waiting room' })
  @ApiOkResponse({
    description: 'Successfully joined the room.',
    type: RoomDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Room ID is not a valid UUID.',
  })
  @ApiNotFoundResponse({
    description: 'Room not found.',
  })
  @ApiConflictResponse({
    description:
      'Room is not accepting players, is full, or the user already belongs to a room.',
  })
  async join(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.joinRoom(id, req.user!.id);
  }

  @Post('join-by-invite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a private room using an invitation code' })
  @ApiOkResponse({
    description: 'Successfully joined the room.',
    type: RoomDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid invitation code format.',
  })
  @ApiNotFoundResponse({
    description: 'Room not found.',
  })
  @ApiConflictResponse({
    description: 'Room is full or user already belongs to a room.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Database temporarily unavailable.',
  })
  async joinByCode(
    @Body() dtoCode: JoinRoomByCodeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.joinByInviteCode(dtoCode, req.user!.id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a room' })
  @ApiOkResponse({
    description: 'Room successfully transitioned to IN_GAME.',
    type: RoomDetailsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Room ID is not a valid UUID.',
  })
  @ApiForbiddenResponse({
    description: 'Only the room host can start the game.',
  })
  @ApiNotFoundResponse({
    description: 'Room not found.',
  })
  @ApiConflictResponse({
    description:
      'Room is not waiting, has fewer than 3 players, or a concurrent operation occurred.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Database temporarily unavailable.',
  })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.startRoom(id, req.user!.id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.roomsService.leaveRoom(id, req.user!.id);
  }
}
