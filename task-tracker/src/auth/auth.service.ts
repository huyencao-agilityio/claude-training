import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { hashPassword, verifyPassword } from '../users/password';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SESSION_COOKIE, signSession } from './session-token';

export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';

// The cookie outlives the token so an expired login still reaches the server and gets the
// "expired" message (AC1.7); the token's own expiry is what ends the login. Persistent, so it
// survives closing the browser (AC1.18).
export const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// id: the UI needs it for "Assign to me" and the assignee's status dropdown (AC3.4, AC3.10)
export type LoggedInUser = { id: string; name: string; role: UserRole };

// Checked when the email has no account, so a wrong email takes as long as a wrong password
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('Dummy-passw0rd'));

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  async login(dto: LoginDto, res: Response): Promise<LoggedInUser> {
    const user = await this.users.findActiveByEmail(dto.email);
    const passwordOk = await verifyPassword(dto.password, user?.passwordHash ?? (await getDummyHash()));
    // One message for every case, so it doesn't tell which part was wrong (AC1.4)
    if (!user || !passwordOk) throw new UnauthorizedException(LOGIN_FAILED_MESSAGE);

    res.cookie(SESSION_COOKIE, signSession(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
    return this.toLoggedInUser(user);
  }

  me(user: User): LoggedInUser {
    return this.toLoggedInUser(user);
  }

  // Only the id, name and role leave the server; never the hash or the email
  private toLoggedInUser(user: User): LoggedInUser {
    return { id: user.id, name: user.name, role: user.role };
  }
}
