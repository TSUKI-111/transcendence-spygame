import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { SessionService } from '../session.service.js';
import type { RequestWithUser } from '../types/request-with-user.type.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    delete req.user;

    const token: unknown = req.cookies?.['__Host-spygame_session'];

    if (typeof token !== 'string') {
      throw new UnauthorizedException('Connexion requise');
    }

    const user = await this.sessions.validate(token);

    if (!user) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    req.user = user;

    return true;
  }
}