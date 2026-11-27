import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

import type {
  RoomEvent,
  RoomPlayerJoinedPayload,
  RoomPlayerLeftPayload,
  RoomHostChangedPayload,
  RoomGameStartedPayload,
  RoomFinishedPayload,
} from './room-events.types.js';

@Injectable()
export class RoomEventsPublisher {
  private readonly eventsSubject = new Subject<RoomEvent>();

  readonly events$ = this.eventsSubject.asObservable();

  publishPlayerJoined(payload: RoomPlayerJoinedPayload): void {
    this.eventsSubject.next({
      event: 'room.player_joined',
      payload,
    });
  }

  publishPlayerLeft(payload: RoomPlayerLeftPayload): void {
    this.eventsSubject.next({
      event: 'room.player_left',
      payload,
    });
  }

  publishHostChanged(payload: RoomHostChangedPayload): void {
    this.eventsSubject.next({
      event: 'room.host_changed',
      payload,
    });
  }

  publishGameStarted(payload: RoomGameStartedPayload): void { 
    this.eventsSubject.next({
      event: 'room.game_started',
      payload,
    });
  }

  publishRoomFinished(payload: RoomFinishedPayload): void {
    this.eventsSubject.next({
      event: 'room.finished',
      payload,
    });
  }
}
