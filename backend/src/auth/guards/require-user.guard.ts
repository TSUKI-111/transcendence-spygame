import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import type { RequestWithUser } from '../types/request-with-user.type.js';

@Injectable()
export class RequireUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    if (!req.user) {
      throw new UnauthorizedException('Connexion requise');
    }

    return true;
  }
}

/*
- @Injectable() permet à NestJS de gérer cette classe.
- implements CanActivate indique que cette classe respecte le contrat d’un garde.
- context.switchToHttp().getRequest() récupère la requête HTTP.
- if (!req.user) vérifie si l’identité est absente.
- UnauthorizedException interrompt la requête avec une réponse 401.
- - return true autorise la poursuite du traitement.
*/