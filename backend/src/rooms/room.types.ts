export type RoomStatus = 'WAITING' | 'IN_GAME';

export type RoomPlayer = {
  id: number;
  name: string;
};

export type Room = {
  id: string;
  name: string;
  host: RoomPlayer;
  players: RoomPlayer[];
  maxPlayers: number;
  status: RoomStatus;
  is_private: boolean;
  createdAt: Date;
};
