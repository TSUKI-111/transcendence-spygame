import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  roomId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  content: string;
}
