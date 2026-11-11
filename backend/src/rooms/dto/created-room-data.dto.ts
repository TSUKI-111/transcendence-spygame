import { ApiProperty } from '@nestjs/swagger';

export class CreatedRoomDataDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique room identifier.',
  })
  id: string;

  @ApiProperty({
    example: 'Soirée espions',
    description: 'Room name.',
  })
  name: string;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the room host.',
  })
  hostId: number;

  @ApiProperty({
    example: 6,
    minimum: 3,
    maximum: 8,
    description: 'Maximum number of players.',
  })
  maxPlayers: number;

  @ApiProperty({
    example: 'WAITING',
    enum: ['WAITING', 'IN_GAME'],
  })
  status: string;

  @ApiProperty({
    example: false,
    description: 'Whether the room is private.',
  })
  isPrivate: boolean;

  @ApiProperty({
    example: '2026-10-29T18:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;
}