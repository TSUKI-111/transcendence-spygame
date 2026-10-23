import { describe, it, expect } from 'vitest';
import { toPublicUser } from './public-user.mapper.js';

describe('toPublicUser', () => {
  it('retourne uniquement les champs publics', () => {
    const user = {
      id: 1,
      username: 'simo_04',
      displayName: 'Simo',
      email: 'simo@example.com',
      passwordHash: 'fake-hash-for-test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = toPublicUser(user);

    expect(result).toEqual({
      id: 1,
      username: 'simo_04',
      displayName: 'Simo',
      avatarUrl: null,
    });

    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('passwordHash');
  });
});