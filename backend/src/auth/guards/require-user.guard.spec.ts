import { describe, it, expect } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { RequireUserGuard } from './require-user.guard.js';

function createContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('RequireUserGuard', () => {
  const guard = new RequireUserGuard();

  it('refuse une requête sans utilisateur avec une erreur 401', () => {
    const context = createContext();

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedException,
    );

    try {
      guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getStatus()).toBe(401);
    }
  });

  it('autorise une requête avec une identité utilisateur', () => {
    const context = createContext({ id: 7 });

    expect(guard.canActivate(context)).toBe(true);
  });
});