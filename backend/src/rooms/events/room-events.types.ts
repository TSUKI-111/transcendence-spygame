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

export interface RoomGameStartedPayload {
  roomId: string;
  gameId: string;
  phase: 'CLUE_SUBMISSION'
  roundNumber: number;
  phaseEndsAt: string;
}

export interface RoomFinishedPayload {
  roomId: string;
  gameId: string;
  status: 'FINISHED' | 'TERMINATED';
  winner: 'SPY' | 'DETECTIVES' | null;
  reason: 'SPY_DEPARTED' | 'INSUFFICIENT_PLAYERS' | null;
  endedAt: string;
}

export interface RoomServerEvents {
  'room.player_joined': (payload: RoomPlayerJoinedPayload) => void;
  'room.player_left': (payload: RoomPlayerLeftPayload) => void;
  'room.host_changed': (payload: RoomHostChangedPayload) => void;
  'room.game_started': (payload: RoomGameStartedPayload) => void;
  'room.finished': (payload: RoomFinishedPayload) => void;
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
    }
  | {
      event: 'room.game_started';
      payload: RoomGameStartedPayload;
    }
  | {
      event: 'room.finished';
      payload: RoomFinishedPayload;
    };