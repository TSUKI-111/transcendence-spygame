import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /health should return application health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
    });
  });

  it('GET /ready should return database readiness', async () => {
    await request(app.getHttpServer()).get('/ready').expect(200).expect({
      status: 'ready',
      database: 'connected',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
