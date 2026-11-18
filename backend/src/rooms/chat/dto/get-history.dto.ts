import { IsUUID } from 'class-validator';

export class GetHistoryDto {
  @IsUUID()
  roomId: string;
}
