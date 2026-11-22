
import { describe, expect, it, vi } from 'vitest';

import {
  retryOnTransactionConflict,
} from './prisma-transaction-retry.js';

describe('retryOnTransactionConflict', () => {

  it('returns a successful result without retrying', async () => {
    const operation = vi.fn().mockResolvedValue('OK');

    const result = await retryOnTransactionConflict(operation);

    expect(result).toBe('OK');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries P2034 and eventually succeeds', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValueOnce('SUCCESS');

    const result = await retryOnTransactionConflict(operation);

    expect(result).toBe('SUCCESS');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('stops after three failed attempts', async () => {
    const error = { code: 'P2034' };

    const operation = vi.fn()
      .mockRejectedValue(error);

    await expect(
      retryOnTransactionConflict(operation)
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry unrelated database errors', async () => {
    const error = { code: 'P2002' };

    const operation = vi.fn()
      .mockRejectedValue(error);

    await expect(
      retryOnTransactionConflict(operation)
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry game-rule errors', async () => {
    const operation = vi.fn()
      .mockRejectedValue(new Error('INVALID_PHASE'));

    await expect(
      retryOnTransactionConflict(operation)
    ).rejects.toThrow('INVALID_PHASE');

    expect(operation).toHaveBeenCalledTimes(1);
  });


it('retries a raw SQL serialization failure', async () => {
  const operation = vi.fn()
    .mockRejectedValueOnce({
      code: 'P2010',
      meta: {
        code: '40001',
      },
    })
    .mockResolvedValueOnce('SUCCESS');

  const result = await retryOnTransactionConflict(operation);

  expect(result).toBe('SUCCESS');
  expect(operation).toHaveBeenCalledTimes(2);
});

});
