import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatedRoomDataDto } from './created-room-data.dto.js';

export class CreatedRoomResponseDto {
  @ApiProperty({
    type: CreatedRoomDataDto,
    description: 'The created room without the stored invitation-code hash.',
  })
  room: CreatedRoomDataDto;

  @ApiPropertyOptional({
    example: 'ABCD7K9M',
    description:
      'Returned only when creating a private room. This is the plain invitation code, not the stored hash.',
  })
  inviteCode?: string;
}