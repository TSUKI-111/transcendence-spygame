import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import type { RequestWithUser } from './types/request-with-user.type.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }


  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(dto);

    response.cookie('__Host-spygame_session', session.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: session.expiresAt,
    });

    response.setHeader('Cache-Control', 'no-store');

    return { message: 'Connexion réussie' };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() req: RequestWithUser) {
    if (!req.user) {
      throw new UnauthorizedException('Connexion requise');
    }

    return this.authService.getCurrentUser(req.user.id);
  }

  @Put('me')
  @UseGuards(SessionAuthGuard)
  @Header('Cache-Control', 'no-store')
  updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Connexion requise');
    }

    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token: unknown = req.cookies?.['__Host-spygame_session'];

    await this.authService.logout(token);

    response.clearCookie('__Host-spygame_session', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Déconnexion réussie' };
  }
}
