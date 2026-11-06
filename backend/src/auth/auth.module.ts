import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RequireUserGuard } from './guards/require-user.guard.js';
import { PasswordService } from './password.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, RequireUserGuard, PasswordService],
  exports: [RequireUserGuard],
})
export class AuthModule {}