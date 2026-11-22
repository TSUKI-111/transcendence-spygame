
import { describe, expect, it, vi } from 'vitest';

import { GameEventsService } from './game-events.service.js';
import type { GameEvent } from './contracts/game-event.type.js';

describe('GameEventsService', () => {
  const event: GameEvent = {
    name: 'game.phase_changed',
    roomId: 'room-123',
    payload: {
      gameId: 'game-123',
      phase: 'DISCUSSION',
      roundNumber: 1,
      phaseEndsAt: '2030-01-01T12:00:00.000Z',
    },
  };

  it('delivers events to subscribers', async () => {
    const service = new GameEventsService();
    const listener = vi.fn();

    service.subscribe(listener);

    await service.publish(event);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('allows subscribers to unsubscribe', async () => {
    const service = new GameEventsService();
    const listener = vi.fn();

    const unsubscribe = service.subscribe(listener);

    await service.publish(event);

    unsubscribe();

    await service.publish(event);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
