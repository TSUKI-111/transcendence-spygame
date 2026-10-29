import { ApiProperty } from "@nestjs/swagger";
import { RoomHostResponseDto } from "./room-host-response.dto.js";

export class RoomListResponseDto{
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Soirée espions' })
  name: string;

  @ApiProperty({ type: RoomHostResponseDto })
  host: RoomHostResponseDto;

  @ApiProperty({ example: 3 })
  playersCount: number;

  @ApiProperty({ example: 6, minimum: 3, maximum: 8 })
  maxPlayers: number;

  @ApiProperty({ enum: ['WAITING', 'IN_GAME'], example: 'WAITING' })
  status: string;

  @ApiProperty({ example: false })
  isPrivate: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}