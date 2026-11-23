import 'reflect-metadata';
import { createHash, randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { io } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import type { Server } from 'socket.io';
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
import { RoomGateway } from '../src/rooms/room.gateway.js';
import { RoomEventsPublisher } from '../src/rooms/events/room-events.publisher.js';

const TEST_DATABASE = 'transcendence_test';
const ORIGIN = 'https://localhost:8443';
const COOKIE_NAME = '__Host-spygame_session';

describe('Authentification Socket.IO — sessions réelles', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let socketServer: Server;
  let baseUrl: string;
  let userId: number;
  let databaseVerified = false;

  const clients = new Set<ClientSocket>();
  const suffix = randomBytes(8).toString('hex');

  const account = {
    username: `ws_${suffix}`,
    displayName: 'WebSocket Test',
    email: `ws_${suffix}@example.com`,
    password: 'Une phrase secrete pour tester',
  };

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (
      !databaseUrl ||
      new URL(databaseUrl).pathname !== `/${TEST_DATABASE}`
    ) {
      throw new Error(
        'Tests refusés : DATABASE_URL doit cibler transcendence_test',
      );
    }

    vi.stubEnv('APP_ORIGIN', ORIGIN);

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
      providers: [
        RoomGateway,
        RoomEventsPublisher,
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

    // Observe afterInit sans remplacer son implémentation :
    // le vrai middleware d'authentification reste exécuté.
    const gateway = app.get(RoomGateway);
    const initSpy = vi.spyOn(gateway, 'afterInit');

    try {
      await app.listen(0, '127.0.0.1');

      const server = initSpy.mock.calls[0]?.[0];

      if (!server) {
        throw new Error('Serveur Socket.IO non initialisé');
      }

      socketServer = server;
    } finally {
      initSpy.mockRestore();
    }

    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);

    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT current_database() AS name
    `;

    if (rows[0]?.name !== TEST_DATABASE) {
      throw new Error('La connexion ne cible pas la base de test');
    }

    databaseVerified = true;

    const registration = await request(baseUrl)
      .post('/auth/register')
      .set('Origin', ORIGIN)
      .send(account)
      .expect(201);

    userId = registration.body.id;
    expect(userId).toEqual(expect.any(Number));
  }, 30_000);

  afterAll(async () => {
    for (const client of clients) {
      client.disconnect();
    }

    try {
      if (databaseVerified) {
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

  async function login(): Promise<string> {
    const response = await request(baseUrl)
      .post('/auth/login')
      .set('Origin', ORIGIN)
      .send({
        email: account.email,
        password: account.password,
      })
      .expect(200);

    const raw = response.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const header = cookies.find((cookie) =>
      cookie.startsWith(`${COOKIE_NAME}=`),
    );

    if (!header) {
      throw new Error('Cookie de session absent');
    }

    return header.split(';')[0]!;
  }

  function connect(
    cookie?: string,
    origin: string | null = ORIGIN,
  ): Promise<ClientSocket> {
    const headers: Record<string, string> = {};

    if (origin !== null) {
      headers.Origin = origin;
    }

    if (cookie) {
      headers.Cookie = cookie;
    }

    const client = io(baseUrl, {
      transports: ['websocket'],
      extraHeaders: headers,
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      timeout: 3_000,
    });

    clients.add(client);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        client.disconnect();
        reject(new Error('Délai de connexion dépassé'));
      }, 5_000);

      client.once('connect', () => {
        clearTimeout(timer);
        resolve(client);
      });

      client.once('connect_error', (error) => {
        clearTimeout(timer);
        client.disconnect();
        reject(error);
      });

      client.connect();
    });
  }

  async function expectRefused(
    cookie?: string,
    origin: string | null = ORIGIN,
  ): Promise<void> {
    // Un timeout ou une panne réseau ne doit pas compter
    // comme un refus d'authentification réussi.
    await expect(connect(cookie, origin)).rejects.toThrow(
      'Connexion non autorisée',
    );
  }

  it('S46 — refuse une connexion sans cookie', async () => {
    await expectRefused();
  });

  it('S47 — refuse un token mal formé', async () => {
    await expectRefused(`${COOKIE_NAME}=abc`);
  });

  it('S47 — refuse un token inconnu', async () => {
    await expectRefused(
      `${COOKIE_NAME}=${randomBytes(32).toString('hex')}`,
    );
  });

  it('refuse une origine externe avec une session valide', async () => {
    const cookie = await login();

    await expectRefused(cookie, 'https://site-externe.example');
  });

  it('refuse une origine absente avec une session valide', async () => {
    const cookie = await login();

    await expectRefused(cookie, null);
  });

  it('S49 — expose la même identité que REST', async () => {
    const cookie = await login();

    const profile = await request(baseUrl)
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    const client = await connect(cookie);

    try {
      const serverSocket = socketServer.sockets.sockets.get(client.id!);

      expect(serverSocket).toBeDefined();
      expect(serverSocket?.data.user).toEqual({
        id: profile.body.id,
      });
      expect(profile.body.id).toBe(userId);
    } finally {
      client.disconnect();
    }
  });

  it('S47 — refuse une session expirée', async () => {
    const cookie = await login();
    const token = cookie.slice(`${COOKIE_NAME}=`.length);
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await prisma.session.update({
      where: { tokenHash },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await expectRefused(cookie);
  });

  it('refuse une nouvelle connexion après logout', async () => {
    const cookie = await login();

    // Vérifie d'abord que cette session fonctionne.
    const client = await connect(cookie);
    client.disconnect();

    await request(baseUrl)
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .expect(200);

    await expectRefused(cookie);
  });
});