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

// export type RoomGamePlayerUpdatedPayload = {
//   roomId: string;
//   gameId: string;
//   userId: number;
// } & (
//   | {
//       participationStatus: 'ELIMINATED' | 'DEPARTED';
//     }
//   | {
//       connectionStatus: 'CONNECTED' | 'DISCONNECTED';
//     }
// );

// export interface RoomGamePhaseChangedPayload {
//   roomId: string;
//   gameId: string;
//   phase: 'CLUE_SUBMISSION' | 'DISCUSSION' | 'VOTING';
//   roundNumber: number;
//   phaseEndsAt: string;
// }

// export interface RoomGameClueSubmittedPayload {
//   roomId: string;
//   gameId: string;
//   roundNumber: number;
//   userId: number;
//   clue: string;
// }

// export interface RoomGameRoundResolvedPayload {
//   roomId: string;
//   gameId: string;
//   roundNumber: number;
//   outcome: 'ELIMINATED' | 'TIE' | 'NO_VOTES';
//   eliminatedUserId: number | null;
//   eliminatedRole: 'SPY' | 'DETECTIVE' | null;
// }

export interface RoomServerEvents {
  'room.player_joined': (payload: RoomPlayerJoinedPayload) => void;
  'room.player_left': (payload: RoomPlayerLeftPayload) => void;
  'room.host_changed': (payload: RoomHostChangedPayload) => void;
  'room.game_started': (payload: RoomGameStartedPayload) => void;
  'room.finished': (payload: RoomFinishedPayload) => void;
  // 'room.game_player_updated': (payload: RoomGamePlayerUpdatedPayload) => void;
  // 'room.game_phase_changed': (payload: RoomGamePhaseChangedPayload) => void;
  // 'room.game_clue_submitted': (payload: RoomGameClueSubmittedPayload) => void;
  // 'room.game_round_resolved': (payload: RoomGameRoundResolvedPayload) => void;
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
  // | {
  //     event: 'room.game_player_updated';
  //     payload: RoomGamePlayerUpdatedPayload;
  //   }
  // | {
  //     event: 'room.game_phase_changed';
  //     payload: RoomGamePhaseChangedPayload;
  //   }
  // | {
  //     event: 'room.game_clue_submitted';
  //     payload: RoomGameClueSubmittedPayload;
  //   }
  // | {
  //     event: 'room.game_round_resolved';
  //     payload: RoomGameRoundResolvedPayload;
  //   };
