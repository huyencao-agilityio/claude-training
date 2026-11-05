import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('never stores the password as plain text (AC1.1)', async () => {
    const hash = await hashPassword('Passw0rd');
    expect(hash).not.toContain('Passw0rd');
    expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('gives two different hashes for the same password (salted)', async () => {
    expect(await hashPassword('Passw0rd')).not.toBe(await hashPassword('Passw0rd'));
  });

  it('accepts the right password', async () => {
    expect(await verifyPassword('Passw0rd', await hashPassword('Passw0rd'))).toBe(true);
  });

  it.each(['passw0rd', 'Passw0rd ', ''])('rejects a wrong password (%j)', async (password) => {
    expect(await verifyPassword(password, await hashPassword('Passw0rd'))).toBe(false);
  });

  it.each(['', 'Passw0rd', 'bcrypt$abc$def', 'scrypt$$'])('rejects a malformed stored hash (%j)', async (stored) => {
    expect(await verifyPassword('Passw0rd', stored)).toBe(false);
  });
});
