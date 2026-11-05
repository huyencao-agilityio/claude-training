import { USER_ROLES, UserRole } from './user.entity';

export type UserEntry = { email: string; name: string; role: UserRole; password: string };

export class UsersFileError extends Error {}

// Same as the email and name columns in user.entity.ts
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 100;

// 8 to 12 characters, at least 1 uppercase letter, 1 lowercase letter and 1 digit
const isValidPassword = (password: string) =>
  password.length >= 8 &&
  password.length <= 12 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password);

const isFilled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const fail = (who: string, problem: string): never => {
  throw new UsersFileError(`Users file: ${who}: ${problem}`);
};

// Checks the whole file before anything is written, so one bad entry leaves the database unchanged.
// The first bad entry wins; it is named by its email, or by its 1-based position when the email is missing.
export function parseUsersFile(json: unknown): UserEntry[] {
  if (!Array.isArray(json)) throw new UsersFileError('Users file: must be a JSON array of users');
  // An empty file would remove every user, so nobody could log in
  if (json.length === 0) throw new UsersFileError('Users file: must list at least one user');

  const seen = new Set<string>();
  return json.map((raw: unknown, index) => {
    const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const { email, name, role, password } = entry;

    if (!isFilled(email)) return fail(`entry ${index + 1}`, 'email is missing');
    // Login compares the email exactly as typed, so a stray space would make the account unusable
    if (email !== email.trim()) fail(email, 'email must not start or end with a space');
    if (email !== email.toLowerCase()) fail(email, 'email must be lowercase');
    // Column limits, checked here so the error names the entry instead of failing in the database
    if (email.length > EMAIL_MAX_LENGTH) fail(email, `email must be at most ${EMAIL_MAX_LENGTH} characters`);
    if (seen.has(email)) fail(email, 'email is used more than once');
    seen.add(email);
    if (!isFilled(name)) fail(email, 'name is missing');
    const trimmedName = (name as string).trim();
    if (trimmedName.length > NAME_MAX_LENGTH) fail(email, `name must be at most ${NAME_MAX_LENGTH} characters`);
    if (typeof password !== 'string' || password === '') fail(email, 'password is missing');
    if (!isValidPassword(password as string)) {
      fail(
        email,
        'password must be 8 to 12 characters with at least 1 uppercase letter, 1 lowercase letter and 1 digit',
      );
    }
    if (!USER_ROLES.includes(role as UserRole)) fail(email, 'role must be "admin" or "user"');

    return { email, name: trimmedName, role: role as UserRole, password: password as string };
  });
}
