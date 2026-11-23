import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AuthModule } from '../src/auth/auth.module.js';
import { CsrfOriginGuard } from '../src/auth/guards/csrf-origin.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const TEST_DATABASE = 'spygame_test';
const ORIGIN = 'https://localhost:8443';

describe('Authentication — parcours complet', () => {
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService;
  let databaseVerified = false;

  const suffix = randomBytes(8).toString('hex');
  const account = { 
    username: `auth_${suffix}`,
    displayName: 'Auth Test',
    email: `auth_${suffix}@example.com`,
    password: 'Une phrase secrete pour tester',
  };

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (
      !connectionString ||
      new URL(connectionString).pathname !== `/${TEST_DATABASE}`
    ) {
      throw new Error(
        'Tests refusés : DATABASE_URL doit cibler spygame_test',
      );
    }

    vi.stubEnv('APP_ORIGIN', ORIGIN);

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      providers: [
        {
          provide: APP_GUARD,
          useClass: CsrfOriginGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT current_database() AS name
    `;

    if (rows[0]?.name !== TEST_DATABASE) {
      throw new Error('La connexion ne cible pas la base de test');
    }

    databaseVerified = true;
  }, 30_000);

  afterAll(async () => {
    try {
      if (databaseVerified) {
        // Nettoyage limité au compte propre à cette exécution.
        // Ses sessions sont supprimées par la relation onDelete: Cascade.
        await prisma.user.deleteMany({
          where: {
            email: account.email,
            username: account.username,
          },
        });
      }
    } finally {
      try {
        await app?.close();
      } finally {
        vi.unstubAllEnvs();
      }
    }
  }, 30_000);

  it('inscription → connexion → profil → déconnexion → accès refusé', async () => {
    if (!app) {
      throw new Error('Application de test non initialisée');
    }

    const server = app.getHttpServer();

    // 1. Une requête anonyme ne peut pas lire le profil.
    await request(server)
      .get('/auth/me')
      .expect(401);

    // 2. Inscription : seul le profil public est retourné.
    const registration = await request(server)
      .post('/auth/register')
      .set('Origin', ORIGIN)
      .send(account)
      .expect(201);

    const publicProfile = {
      id: expect.any(Number),
      username: account.username,
      displayName: account.displayName,
      avatarUrl: null,
    };

    expect(registration.body).toEqual(publicProfile);

    // 3. Le mot de passe est stocké sous forme de hash Argon2id.
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email: account.email },
    });

    expect(storedUser.passwordHash).not.toBe(account.password);
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);

    // 4. Un mauvais mot de passe est refusé.
    await request(server)
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({
        email: account.email,
        password: 'Un mauvais mot de passe',
      })
      .expect(401);

    // 5. Connexion avec les bons identifiants.
    const login = await request(server)
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({
        email: account.email,
        password: account.password,
      })
      .expect(200);

    expect(login.body).toEqual({
      message: 'Connexion réussie',
    });

    const rawCookies = login.headers['set-cookie'];
    const cookies = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [rawCookies]
        : [];

    const sessionHeader = cookies.find((cookie) =>
      cookie.startsWith('__Host-spygame_session='),
    );

    if (!sessionHeader) {
      throw new Error('Cookie de session absent');
    }

    expect(sessionHeader).toMatch(/;\s*HttpOnly/i);
    expect(sessionHeader).toMatch(/;\s*Secure/i);
    expect(sessionHeader).toMatch(/;\s*SameSite=Strict/i);
    expect(sessionHeader).toMatch(/;\s*Path=\/(?:;|$)/i);

    // Supertest utilise HTTP ici : transmission explicite du cookie.
    const sessionCookie = sessionHeader.split(';')[0]!;

    // 6. La session permet de lire le profil.
    const profile = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(profile.body).toEqual(publicProfile);

    // 7. Modification du profil et suppression des espaces.
    const updated = await request(server)
      .put('/auth/me')
      .set('Origin', ORIGIN)
      .set('Cookie', sessionCookie)
      .send({ displayName: '  Updated Name  ' })
      .expect(200);

    expect(updated.body).toEqual({
      ...publicProfile,
      displayName: 'Updated Name',
    });

    // 8. Vérification de la persistance.
    const savedProfile = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(savedProfile.body.displayName).toBe('Updated Name');

    // 9. Déconnexion.
    await request(server)
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', sessionCookie)
      .expect(200);

    // 10. Le même cookie ne fonctionne plus.
    await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .expect(401);

    expect(
      await prisma.session.count({
        where: { userId: storedUser.id },
      }),
    ).toBe(0);
  }, 30_000);
});