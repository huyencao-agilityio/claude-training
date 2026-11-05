import { assertSessionSecretConfigured, sessionTtlMs, signSession, verifySession } from './session-token';

describe('session token', () => {
  const LOGIN_AT = Date.UTC(2026, 10, 5, 8, 0, 0);
  const HOUR = 60 * 60 * 1000;
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('accepts its own token and returns the user id', () => {
    const token = signSession('user-1', LOGIN_AT);
    expect(verifySession(token, LOGIN_AT + HOUR)).toEqual({ status: 'ok', userId: 'user-1' });
  });

  it('is still valid one second before 24 hours (AC1.18)', () => {
    const token = signSession('user-1', LOGIN_AT);
    expect(verifySession(token, LOGIN_AT + 24 * HOUR - 1000).status).toBe('ok');
  });

  it('is expired exactly 24 hours after login (AC1.7)', () => {
    const token = signSession('user-1', LOGIN_AT);
    expect(verifySession(token, LOGIN_AT + 24 * HOUR)).toEqual({ status: 'expired' });
  });

  it('takes the duration from SESSION_TTL_SECONDS', () => {
    process.env.SESSION_TTL_SECONDS = '60';
    const token = signSession('user-1', LOGIN_AT);
    expect(verifySession(token, LOGIN_AT + 59_000).status).toBe('ok');
    expect(verifySession(token, LOGIN_AT + 60_000).status).toBe('expired');
  });

  it.each(['abc', '0', '-5', ''])('falls back to 24 hours for an unusable SESSION_TTL_SECONDS (%j)', (value) => {
    process.env.SESSION_TTL_SECONDS = value;
    expect(sessionTtlMs()).toBe(24 * HOUR);
  });

  it('rejects a token whose payload was changed', () => {
    const [, mac] = signSession('user-1', LOGIN_AT).split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'admin-id', iat: LOGIN_AT, exp: LOGIN_AT + 1000 * HOUR }),
    ).toString('base64url');
    expect(verifySession(`${forged}.${mac}`, LOGIN_AT)).toEqual({ status: 'invalid' });
  });

  it('rejects a token whose signature was changed', () => {
    const [body, mac] = signSession('user-1', LOGIN_AT).split('.');
    const flipped = (mac[0] === 'A' ? 'B' : 'A') + mac.slice(1);
    expect(verifySession(`${body}.${flipped}`, LOGIN_AT)).toEqual({ status: 'invalid' });
  });

  it('rejects a token signed with another secret', () => {
    process.env.SESSION_SECRET = 'secret-one';
    const token = signSession('user-1', LOGIN_AT);
    process.env.SESSION_SECRET = 'secret-two';
    expect(verifySession(token, LOGIN_AT)).toEqual({ status: 'invalid' });
  });

  it('does not report an expired token as expired when its signature is wrong', () => {
    const [body] = signSession('user-1', LOGIN_AT).split('.');
    expect(verifySession(`${body}.bad`, LOGIN_AT + 48 * HOUR)).toEqual({ status: 'invalid' });
  });

  describe('assertSessionSecretConfigured', () => {
    const LONG_SECRET = 's'.repeat(32);

    it.each([
      ['not set', undefined],
      ['too short', 'secret'],
      ['31 characters', 's'.repeat(31)],
    ])('refuses to start in production when SESSION_SECRET is %s', (_, secret) => {
      process.env.NODE_ENV = 'production';
      if (secret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = secret;
      expect(() => assertSessionSecretConfigured()).toThrow(
        'SESSION_SECRET must be set to at least 32 characters when NODE_ENV=production',
      );
    });

    it('starts in production with a secret of 32 characters', () => {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = LONG_SECRET;
      expect(() => assertSessionSecretConfigured()).not.toThrow();
    });

    it.each(['development', 'test', undefined])('allows the dev-only secret when NODE_ENV is %s', (env) => {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
      delete process.env.SESSION_SECRET;
      expect(() => assertSessionSecretConfigured()).not.toThrow();
    });
  });

  it('warns once when SESSION_SECRET is not set, and not when it is', () => {
    jest.isolateModules(() => {
      const { Logger } = require('@nestjs/common');
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const fresh = require('./session-token');

      process.env.SESSION_SECRET = 'set';
      fresh.signSession('user-1', LOGIN_AT);
      expect(warn).not.toHaveBeenCalled();

      delete process.env.SESSION_SECRET;
      fresh.signSession('user-1', LOGIN_AT);
      fresh.signSession('user-1', LOGIN_AT);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('SESSION_SECRET is not set');
      warn.mockRestore();
    });
  });

  it.each(['', 'abc', 'a.b.c', '.', 'abc.', '.abc'])('rejects a malformed token (%j)', (token) => {
    expect(verifySession(token, LOGIN_AT)).toEqual({ status: 'invalid' });
  });
});
