export enum ChatChannel {
  LOBBY = 'LOBBY',
  DISCUSSION = 'DISCUSSION',
}

export interface SendMessagePayload {
  roomId: string;
  channel: ChatChannel;
  content: string;
}

export interface ChatMessagePayload {
  id: number;
  roomId: string;
  userId: number;
  username: string;
  displayName: string;
  channel: ChatChannel;
  content: string;
  createdAt Date;
}

