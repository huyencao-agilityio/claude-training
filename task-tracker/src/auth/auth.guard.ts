import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SESSION_COOKIE, verifySession } from './session-token';

export const SESSION_EXPIRED_MESSAGE = 'Your login has expired. Please log in again.';

const IS_PUBLIC = 'isPublic';
// Skips the login check; only POST /auth/login uses it
export const Public = () => SetMetadata(IS_PUBLIC, true);

export type AuthenticatedRequest = Request & { user: User };

// Reads one cookie from the raw Cookie header (no cookie-parser installed)
const readCookie = (header: string | undefined, name: string): string | undefined => {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
};

// Registered as APP_GUARD, so every endpoint, including future ones, needs a login unless @Public().
// Guards run before pipes and handlers: a 401 here means nothing is read, saved or streamed.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException();

    const session = verifySession(token);
    if (session.status === 'expired') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: SESSION_EXPIRED_MESSAGE,
        error: 'SessionExpired',
      });
    }
    if (session.status === 'invalid') throw new UnauthorizedException();
    // A validly signed token always holds a uuid; anything else would make the uuid query fail with a 500
    if (!isUUID(session.userId)) throw new UnauthorizedException();

    // null when a reload of the users file removed this user (AC1.1)
    const user = await this.users.findActiveById(session.userId);
    if (!user) throw new UnauthorizedException();

    req.user = user;
    return true;
  }
}
