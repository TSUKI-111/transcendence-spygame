import {IsInt, IsString, MinLength, MaxLength, Max, Min, IsBoolean, IsOptional} from 'class-validator'

export class CreateRoomDto {
  @IsString()
  @MaxLength(30)
  @MinLength(3)
  name: string;

  @IsOptional()
  @IsInt()
  @Max(8)
  @Min(3)
  max_players: number = 8;

  @IsOptional()
  @IsBoolean()
  is_private: boolean = false;
}
