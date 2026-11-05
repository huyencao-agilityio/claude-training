import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: object) => pipe.transform(body, { type: 'body', metatype: LoginDto });

  it('accepts an email and a password', async () => {
    await expect(validate({ email: 'alice@example.com', password: 'Passw0rd' })).resolves.toEqual({
      email: 'alice@example.com',
      password: 'Passw0rd',
    });
  });

  it.each([
    ['email missing', { password: 'Passw0rd' }],
    ['email empty', { email: '', password: 'Passw0rd' }],
    ['password missing', { email: 'alice@example.com' }],
    ['password empty', { email: 'alice@example.com', password: '' }],
    ['email not a string', { email: 1, password: 'Passw0rd' }],
  ])('rejects the body with %s (AC1.5)', async (_, body) => {
    await expect(validate(body)).rejects.toThrow(BadRequestException);
  });

  it('keeps the email exactly as typed, not trimmed or lowercased (Q-28)', async () => {
    await expect(validate({ email: ' Alice@example.com ', password: 'Passw0rd' })).resolves.toMatchObject({
      email: ' Alice@example.com ',
    });
  });

  it('does not check the password rules (the users seed does)', async () => {
    await expect(validate({ email: 'alice@example.com', password: 'x' })).resolves.toMatchObject({ password: 'x' });
  });

  it('rejects a password over 128 characters', async () => {
    await expect(validate({ email: 'alice@example.com', password: 'a'.repeat(129) })).rejects.toThrow(
      BadRequestException,
    );
  });
});
