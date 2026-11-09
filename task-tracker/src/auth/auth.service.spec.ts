import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { hashPassword } from '../users/password';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService, LOGIN_FAILED_MESSAGE, SESSION_COOKIE_MAX_AGE_MS } from './auth.service';
import { verifySession } from './session-token';

describe('AuthService', () => {
  let alice: User;
  const users = { findActiveByEmail: jest.fn() };
  const res = { cookie: jest.fn() };
  const service = new AuthService(users as unknown as UsersService);
  const login = (email: string, password: string) =>
    service.login({ email, password }, res as unknown as Response);

  beforeAll(async () => {
    alice = {
      id: 'alice-id',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'user',
      passwordHash: await hashPassword('Passw0rd'),
      removedAt: null,
    } as User;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Only an active user with this exact email is found, like UsersService.findActiveByEmail
    users.findActiveByEmail.mockImplementation(async (email: string) => (email === alice.email ? alice : null));
  });

  it('returns only the name and role on a correct login (AC1.3, AC1.13)', async () => {
    await expect(login('alice@example.com', 'Passw0rd')).resolves.toEqual({ id: alice.id, name: 'Alice', role: 'user' });
  });

  it('sets an HttpOnly, persistent session cookie for this user (AC1.18)', async () => {
    await login('alice@example.com', 'Passw0rd');

    expect(res.cookie).toHaveBeenCalledWith('session', expect.any(String), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
    const token = res.cookie.mock.calls[0][1];
    expect(verifySession(token)).toEqual({ status: 'ok', userId: 'alice-id' });
  });

  it.each([
    ['a wrong password (TC-05)', 'alice@example.com', 'Wrong0pass'],
    ['an email with no account (TC-06)', 'nobody@example.com', 'Passw0rd'],
    ['an email with an uppercase letter (TC-60)', 'Alice@example.com', 'Passw0rd'],
    ['an email with spaces around it', ' alice@example.com', 'Passw0rd'],
  ])('rejects %s with the same message and no cookie (AC1.4)', async (_, email, password) => {
    const attempt = login(email, password);
    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(attempt).rejects.toThrow(LOGIN_FAILED_MESSAGE);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rejects a user removed from the users file (AC1.1, TC-56)', async () => {
    // findActiveByEmail skips removed users, so a removed user looks like an unknown email
    users.findActiveByEmail.mockResolvedValue(null);
    await expect(login('alice@example.com', 'Passw0rd')).rejects.toThrow(LOGIN_FAILED_MESSAGE);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('returns the logged-in user without the hash or email', () => {
    expect(service.me(alice)).toEqual({ id: alice.id, name: 'Alice', role: 'user' });
  });
});
