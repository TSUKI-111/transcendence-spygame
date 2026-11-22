import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RequireUserGuard } from './guards/require-user.guard.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RequireUserGuard,
    SessionAuthGuard,
    PasswordService,
    SessionService,
  ],
  exports: [RequireUserGuard, SessionAuthGuard, SessionService],
})
export class AuthModule {}
