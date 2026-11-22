import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from './types/authenticated-user.type.js';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async validate(token: string): Promise<AuthenticatedUser | null> {
    if (!TOKEN_PATTERN.test(token)) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: this.hashToken(token),
      },
      select: {
        userId: true,
        expiresAt: true,
      },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return { id: session.userId };
  }

  async revoke(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) {
      return;
    }

    await this.prisma.session.deleteMany({
      where: {
        tokenHash: this.hashToken(token),
      },
    });
  }
}