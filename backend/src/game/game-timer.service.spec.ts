
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { GameService } from './game.service.js';
import { GameTimerService } from './game-timer.service.js';

describe('GameTimerService', () => {
  let service: GameTimerService;

  const prismaMock = {
    game: {
      findMany: vi.fn(),
    },
  };

  const gameServiceMock = {
    advancePhaseIfExpired: vi.fn(),
  };

  beforeEach(() => {
    prismaMock.game.findMany.mockReset();

    gameServiceMock.advancePhaseIfExpired.mockReset();

    prismaMock.game.findMany.mockResolvedValue([]);

    gameServiceMock.advancePhaseIfExpired
      .mockResolvedValue(true);

    service = new GameTimerService(
      prismaMock as unknown as PrismaService,
      gameServiceMock as unknown as GameService,
    );
  });

  it('checks PostgreSQL for expired games', async () => {
    await service.checkExpiredGames();

    expect(prismaMock.game.findMany)
      .toHaveBeenCalledWith({
        where: {
          phase: {
            in: [
              'CLUE_SUBMISSION',
              'DISCUSSION',
              'VOTING',
            ],
          },
          phaseEndsAt: {
            lte: expect.any(Date),
          },
        },

        select: {
          id: true,
        },

        orderBy: {
          phaseEndsAt: 'asc',
        },

        take: 100,
      });
  });

  it('advances every expired game', async () => {
    prismaMock.game.findMany.mockResolvedValueOnce([
      { id: 'game-1' },
      { id: 'game-2' },
    ]);

    await service.checkExpiredGames();

    expect(
      gameServiceMock.advancePhaseIfExpired
    ).toHaveBeenCalledTimes(2);

    expect(
      gameServiceMock.advancePhaseIfExpired
    ).toHaveBeenCalledWith('game-1');

    expect(
      gameServiceMock.advancePhaseIfExpired
    ).toHaveBeenCalledWith('game-2');
  });

  it('does not advance when no game is expired', async () => {
    await service.checkExpiredGames();

    expect(
      gameServiceMock.advancePhaseIfExpired
    ).not.toHaveBeenCalled();
  });

  it('continues after an individual game fails', async () => {
    prismaMock.game.findMany.mockResolvedValueOnce([
      { id: 'game-1' },
      { id: 'game-2' },
    ]);

    gameServiceMock.advancePhaseIfExpired
      .mockRejectedValueOnce(new Error('DATABASE_ERROR'))
      .mockResolvedValueOnce(true);

    await service.checkExpiredGames();

    expect(
      gameServiceMock.advancePhaseIfExpired
    ).toHaveBeenCalledTimes(2);
  });

  it('prevents overlapping timer checks', async () => {
    // Call twice without waiting for the first one.
    await Promise.all([
      service.checkExpiredGames(),
      service.checkExpiredGames(),
    ]);

    expect(prismaMock.game.findMany)
      .toHaveBeenCalledTimes(1);
  });
});
