import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toPublicUser } from '../users/public-user.mapper.js';
import type { PublicUser } from '../users/public-user.type.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthenticatedUser } from './types/authenticated-user.type.js';
import { SessionService } from './session.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          displayName: dto.displayName.trim(),
          email: dto.email.toLowerCase(),
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

      return toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Pseudo ou email déjà utilisé');
      }

      throw error;
    }
  }
  async validateCredentials(dto: LoginDto): Promise<AuthenticatedUser> {
  const user = await this.prisma.user.findUnique({
    where: {
      email: dto.email.toLowerCase(),
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isValid = await this.passwords.verify(
        user.passwordHash,
        dto.password,
    );

    if (!isValid) {
        throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

       return { id: user.id };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.validateCredentials(dto);

    return this.sessions.create(user.id);
  }
  async getCurrentUser(userId: number): Promise<PublicUser> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

  if (!user) {
    throw new UnauthorizedException('Connexion requise');
  }

  return toPublicUser(user);
  }
  async logout(token: unknown): Promise<void> {
  if (typeof token === 'string') {
    await this.sessions.revoke(token);
    }

  }

    async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

      return toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UnauthorizedException('Connexion requise');
      }

      throw error;
    }
  }

}
