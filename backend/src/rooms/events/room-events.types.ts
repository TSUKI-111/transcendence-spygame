export interface PublicPlayer {
  id: number;
  username: string;
  displayName: string;
}

export interface RoomPlayerJoinedPayload {
  roomId: string;
  player: PublicPlayer;
}

export interface RoomPlayerLeftPayload {
  roomId: string;
  playerId: number;
}

export interface RoomHostChangedPayload {
  roomId: string;
  previousHostId: number;
  newHostId: number;
}

export interface RoomServerEvents {
  'room.player_joined': (payload: RoomPlayerJoinedPayload) => void;
  'room.player_left': (payload: RoomPlayerLeftPayload) => void;
  'room.host_changed': (payload: RoomHostChangedPayload) => void;
}

export type RoomEvent =
  | {
      event: 'room.player_joined';
      payload: RoomPlayerJoinedPayload;
    }
  | {
      event: 'room.player_left';
      payload: RoomPlayerLeftPayload;
    }
  | {
      event: 'room.host_changed';
      payload: RoomHostChangedPayload;
    };
