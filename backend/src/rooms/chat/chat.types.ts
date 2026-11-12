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
  createdAt: Date;
}
