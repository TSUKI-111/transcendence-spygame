import {IsInt, IsString, MinLength, MaxLength, Max, Min, IsBoolean, IsOptional, Matches} from 'class-validator'
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    example: 'Soirée espions',
    description: 'Room name, trimmed before validation.',
    minLength: 3,
    maxLength: 30,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @Matches(/\S/, {message: 'name must contain at least one non-whitespace character'})
  @MaxLength(30)
  @MinLength(3)
  name: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'Maximum number of players, from 3 to 8. Defaults to 8.',
    minimum: 3,
    maximum: 8,
    default: 8,
  })
  @IsOptional()
  @IsInt()
  @Max(8)
  @Min(3)
  max_players: number = 8;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the room is private. Defaults to false.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_private: boolean = false;
}
