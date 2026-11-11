import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class JoinRoomByCodeDto {
  @IsNotEmpty()
  @IsString()
  @Length(8, 8)
  @Matches(/^[A-HJ-NP-Z2-9]{8}$/)
  inviteCode: string;
}
