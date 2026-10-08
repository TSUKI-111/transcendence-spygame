import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      status: 'ok',
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ready',
      database: 'connected',
    };
  }
}