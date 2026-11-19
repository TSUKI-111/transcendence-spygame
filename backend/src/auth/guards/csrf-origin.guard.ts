import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private readonly trustedOrigin: string;

  constructor() {
    const origin = process.env.APP_ORIGIN;

    if (!origin) {
      throw new Error('APP_ORIGIN doit être définie');
    }

    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('APP_ORIGIN doit être une URL valide');
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.origin !== origin
    ) {
      throw new Error(
        'APP_ORIGIN doit être une origine HTTPS sans chemin ni slash final',
      );
    }

    this.trustedOrigin = origin;
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) {
      return true;
    }

    if (req.headers.origin !== this.trustedOrigin) {
      throw new ForbiddenException('Origine de la requête refusée');
    }

    return true;
  }
}