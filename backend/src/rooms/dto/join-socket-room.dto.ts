import { IsUUID } from 'class-validator';

export class JoinSocketRoomDto {
  @IsUUID()
  roomId: string;
}
