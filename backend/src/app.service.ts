import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getDbStatus() {
    const count = await this.prisma.foundationTest.count();

    return {
      database: 'connected',
      foundationTestRows: count,
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