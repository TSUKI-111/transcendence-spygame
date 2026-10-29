import { ApiProperty } from '@nestjs/swagger';
import { RoomListResponseDto } from './room-list-response.dto.js';
import { RoomPlayerResponseDto } from './room-player-response.dto.js';

export class RoomDetailsResponseDto extends RoomListResponseDto {
  @ApiProperty({
    type: [RoomPlayerResponseDto],
    example: [
      { id: 1, displayName: 'Marouan' },
      { id: 2, displayName: 'Yassine' },
    ],
  })
  players: RoomPlayerResponseDto[];
}