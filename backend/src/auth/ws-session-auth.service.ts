import { Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { SessionService } from './session.service.js';

const COOKIE_NAME = '__Host-spygame_session';

@Injectable()
export class WsSessionAuthService {
  private readonly trustedOrigin: string;

  constructor(private readonly sessions: SessionService) {
    const origin = process.env.APP_ORIGIN;

    if (!origin) {
      throw new Error('APP_ORIGIN doit être définie');
    }

    const parsed = new URL(origin);

    if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
      throw new Error(
        'APP_ORIGIN doit être une origine HTTPS sans chemin ni slash final',
      );
    }

    this.trustedOrigin = origin;
  }

  async authenticate(socket: Socket): Promise<void> {
    delete socket.data.user;

    if (socket.handshake.headers.origin !== this.trustedOrigin) {
      throw new Error('Origine de la connexion refusée');
    }

    const token = this.readSessionCookie(
      socket.handshake.headers.cookie,
    );

    if (!token) {
      throw new Error('Connexion requise');
    }

    const user = await this.sessions.validate(token);

    if (!user) {
      throw new Error('Session invalide ou expirée');
    }

    socket.data.user = user;
  }

  private readSessionCookie(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const values: string[] = [];

    for (const part of header.split(';')) {
      const separator = part.indexOf('=');

      if (separator === -1) {
        continue;
      }

      const name = part.slice(0, separator).trim();

      if (name === COOKIE_NAME) {
        values.push(part.slice(separator + 1).trim());
      }
    }

    return values.length === 1 ? values[0]! : null;
  }
}