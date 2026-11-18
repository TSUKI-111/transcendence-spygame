import type { ChatChannel } from '../../generated/prisma/client.js';

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface ChatMessagePayload {
  id: number;
  roomId: string;
  userId: number;
  username: string;
  displayName: string;
  content: string;
  channel: ChatChannel;
  createdAt: Date;
}

export interface ChatErrorPayload {
  code:
    | 'ROOM_NOT_FOUND'
    | 'ROOM_ACCESS_DENIED'
    | 'MESSAGE_EMPTY'
    | 'MESSAGE_TOO_LONG'
    | 'CHAT_NOT_AVAILABLE'
    | 'VALIDATION_ERROR'
    | 'INTERNAL_ERROR';

  message: string;
}

export interface ChatHistoryPayload {
  roomId: string;
  messages: ChatMessagePayload[];
}
