type RoomStatus = "WAITING" | "IN_GAME";

type RoomPlayer = {
  id: number;
  name: string;
};

export type Room = {
  name: string;
  host: RoomPlayer;
  players: RoomPlayer[];
  max_players: number;
  status: RoomStatus;
  is_private: boolean;
};
