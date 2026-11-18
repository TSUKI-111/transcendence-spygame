
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, beforeEach } from 'vitest';
import { GameService } from './game.service.js';

describe('GameService', () =>
{
  let service: GameService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [GameService],
    }).compile();

    service = moduleRef.get<GameService>(GameService);
  });

  it('starts a game with 3 players', async () => {
    const roomId = randomUUID();

    const result = await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });

    expect(result.gameId).toEqual(expect.any(String));
    expect(result.roomId).toBe(roomId);
    expect(result.phase).toBe('CLUE_SUBMISSION');
    expect(result.roundNumber).toBe(1);
    expect(Number.isFinite(Date.parse(result.phaseEndsAt)))
      .toBe(true);

    // No private game data in M4's response
    expect(result).not.toHaveProperty('secretWord');
    expect(result).not.toHaveProperty('players');
  });

  it('rejects fewer than 3 players', async () => {
    await expect(
      service.startGame({
        roomId: randomUUID(),
        participantIds: [1, 2],
      }),
    ).rejects.toThrow('INVALID_PLAYER_COUNT');
  });

  it('rejects duplicate player IDs', async () => {
    await expect(
      service.startGame({
        roomId: randomUUID(),
        participantIds: [1, 2, 2],
      }),
    ).rejects.toThrow('DUPLICATE_PLAYERS');
  });

  it('prevents starting twice in the same room', async () => {
    const roomId = randomUUID();

    await service.startGame({
      roomId,
      participantIds: [1, 2, 3],
    });

    await expect(
      service.startGame({
        roomId,
        participantIds: [1, 2, 3],
      }),
    ).rejects.toThrow('GAME_ALREADY_ACTIVE');
  });


  it('assigns exactly one Spy and hides the word', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    const states = [1, 2, 3].map(userId =>
      service.getPlayerState(result.gameId, userId)
    );

    const spies = states.filter(
      state => state.role === 'SPY'
    );

    const detectives = states.filter(
      state => state.role === 'DETECTIVE'
    );

    expect(spies).toHaveLength(1);
    expect(detectives).toHaveLength(2);

    expect(spies[0]).not.toHaveProperty('secretWord');

    expect(detectives[0].secretWord)
      .toEqual(expect.any(String));

    expect(detectives[0].secretWord)
      .toBe(detectives[1].secretWord);
  });

  it('rejects a player who is not in the game', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    expect(() =>
      service.getPlayerState(result.gameId, 99)
    ).toThrow('NOT_GAME_PARTICIPANT');
  });

  it('rejects an unknown game ID', () => {
    expect(() =>
      service.getPlayerState(randomUUID(), 1)
    ).toThrow('GAME_NOT_FOUND');
  });


  it('does not advance before the deadline', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    const deadline = Date.parse(result.phaseEndsAt);

    const changed = service.advancePhaseIfExpired(
      result.gameId,
      deadline - 1,
    );

    expect(changed).toBe(false);

    const state = service.getPlayerState(result.gameId, 1);

    expect(state.phase).toBe('CLUE_SUBMISSION');
  });

  it('moves from clues to discussion', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    const deadline = Date.parse(result.phaseEndsAt);

    const changed = service.advancePhaseIfExpired(
      result.gameId,
      deadline,
    );

    expect(changed).toBe(true);

    const state = service.getPlayerState(result.gameId, 1);

    expect(state.phase).toBe('DISCUSSION');
    expect(state.phaseEndsAt).toBe(
      new Date(deadline + 120_000).toISOString()
    );
  });

  it('moves from discussion to voting', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    const clueDeadline = Date.parse(result.phaseEndsAt);

    service.advancePhaseIfExpired(
      result.gameId,
      clueDeadline,
    );

    const discussionDeadline = clueDeadline + 120_000;

    service.advancePhaseIfExpired(
      result.gameId,
      discussionDeadline,
    );

    const state = service.getPlayerState(result.gameId, 1);

    expect(state.phase).toBe('VOTING');
    expect(state.phaseEndsAt).toBe(
      new Date(discussionDeadline + 30_000).toISOString()
    );
  });

  it('does not resolve voting before voting logic exists', async () => {
    const result = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });

    const clueDeadline = Date.parse(result.phaseEndsAt);

    service.advancePhaseIfExpired(result.gameId, clueDeadline);
    service.advancePhaseIfExpired(
      result.gameId,
      clueDeadline + 120_000,
    );

    expect(() =>
      service.advancePhaseIfExpired(
        result.gameId,
        clueDeadline + 150_000,
      )
    ).toThrow('ROUND_RESOLUTION_NOT_IMPLEMENTED');
  });

  
  it('accepts a valid clue and trims spaces', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    const accepted = service.submitClue(
      game.gameId,
      1,
      '  Water  ',
    );
  
    expect(accepted.clue).toBe('Water');
    expect(accepted.userId).toBe(1);
    expect(accepted.roundNumber).toBe(1);
  
    const state = service.getPlayerState(game.gameId, 2);
  
    expect(state.clues).toHaveLength(1);
    expect(state.clues[0].clue).toBe('Water');
  });
  
  it('rejects a second clue from the same player', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    service.submitClue(game.gameId, 1, 'Water');
  
    expect(() =>
      service.submitClue(game.gameId, 1, 'Beach')
    ).toThrow('CLUE_ALREADY_SUBMITTED');
  });
  
  it('rejects a duplicate clue ignoring capitalization', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    service.submitClue(game.gameId, 1, 'Water');
  
    expect(() =>
      service.submitClue(game.gameId, 2, 'wAtEr')
    ).toThrow('DUPLICATE_CLUE');
  });
  
  it('rejects empty clues and clues longer than 100 characters', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    expect(() =>
      service.submitClue(game.gameId, 1, '   ')
    ).toThrow('EMPTY_CLUE');
  
    expect(() =>
      service.submitClue(game.gameId, 1, 'a'.repeat(101))
    ).toThrow('CLUE_TOO_LONG');
  });
  
  it('rejects clues from nonparticipants', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    expect(() =>
      service.submitClue(game.gameId, 99, 'Water')
    ).toThrow('NOT_GAME_PARTICIPANT');
  });
  
  it('rejects clues after the deadline', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    const deadline = Date.parse(game.phaseEndsAt);
  
    expect(() =>
      service.submitClue(
        game.gameId,
        1,
        'Water',
        deadline,
      )
    ).toThrow('PHASE_EXPIRED');
  });
  
  it('rejects clues outside the clue phase', async () => {
    const game = await service.startGame({
      roomId: randomUUID(),
      participantIds: [1, 2, 3],
    });
  
    const deadline = Date.parse(game.phaseEndsAt);
  
    service.advancePhaseIfExpired(game.gameId, deadline);
  
    expect(() =>
      service.submitClue(game.gameId, 1, 'Water')
    ).toThrow('INVALID_PHASE');
  });

});
