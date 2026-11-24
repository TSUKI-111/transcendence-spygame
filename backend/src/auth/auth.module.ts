import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RequireUserGuard } from './guards/require-user.guard.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { WsSessionAuthService } from './ws-session-auth.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RequireUserGuard,
    SessionAuthGuard,
    PasswordService,
    SessionService,
    WsSessionAuthService,
  ],
  exports: [RequireUserGuard, SessionAuthGuard, SessionService, WsSessionAuthService],
})
export class AuthModule {}
