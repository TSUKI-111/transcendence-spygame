import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ChatChannel } from '../chat.types.js';

export class SendMessageDto {
  @IsUUID()
  roomId: string;

  @IsEnum(ChatChannel)
  channel: ChatChannel;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  content: string;
}
