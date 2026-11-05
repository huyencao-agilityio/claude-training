import { parseUsersFile, UsersFileError } from './users-file';

describe('parseUsersFile', () => {
  const admin = { email: 'admin@example.com', name: 'Admin', role: 'admin', password: 'Passw0rd' };
  const alice = { email: 'alice@example.com', name: 'Alice', role: 'user', password: 'Passw0rd' };
  const bob = { email: 'bob@example.com', name: 'Bob', role: 'user', password: 'Passw0rd' };

  const errorFor = (json: unknown) => {
    try {
      parseUsersFile(json);
    } catch (err) {
      expect(err).toBeInstanceOf(UsersFileError);
      return (err as Error).message;
    }
    throw new Error('expected parseUsersFile to throw');
  };

  it('returns every entry of a valid file (AC1.1, TC-01)', () => {
    expect(parseUsersFile([admin, alice, bob])).toEqual([admin, alice, bob]);
  });

  it('drops fields that are not part of a user', () => {
    expect(parseUsersFile([{ ...alice, extra: 'x' }])).toEqual([alice]);
  });

  it.each(['Passw0rd', 'Passw0rd1234'])('accepts a %s-length password at the limits (TC-41)', (password) => {
    expect(parseUsersFile([{ ...alice, password }])).toEqual([{ ...alice, password }]);
  });

  it.each([
    ['no uppercase (TC-02)', 'password1'],
    ['7 characters (TC-03)', 'Pass0rd'],
    ['13 characters (TC-40)', 'Passw0rd12345'],
    ['no digit', 'Password'],
    ['no lowercase', 'PASSW0RD'],
  ])('rejects a password with %s and names the email (AC1.2)', (_, password) => {
    expect(errorFor([admin, { ...bob, password }])).toBe(
      'Users file: bob@example.com: password must be 8 to 12 characters with at least 1 uppercase letter, 1 lowercase letter and 1 digit',
    );
  });

  it('rejects an email used twice (TC-57)', () => {
    expect(errorFor([alice, bob, { ...alice, name: 'Alice 2' }])).toBe(
      'Users file: alice@example.com: email is used more than once',
    );
  });

  it('rejects a role other than admin or user (TC-58)', () => {
    expect(errorFor([admin, { ...bob, role: 'manager' }])).toBe(
      'Users file: bob@example.com: role must be "admin" or "user"',
    );
  });

  it('rejects an email with an uppercase letter (TC-59)', () => {
    expect(errorFor([admin, { ...bob, email: 'Bob@example.com' }])).toBe(
      'Users file: Bob@example.com: email must be lowercase',
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('names the 1-based position when the email is %s', (_, email) => {
    expect(errorFor([admin, alice, { ...bob, email }])).toBe('Users file: entry 3: email is missing');
  });

  it('names the position of an entry that is not an object', () => {
    expect(errorFor([admin, 'bob@example.com'])).toBe('Users file: entry 2: email is missing');
  });

  it.each([' bob@example.com', 'bob@example.com ', ' bob@example.com '])(
    'rejects an email with spaces around it (%j), since login could never match it',
    (email) => {
      expect(errorFor([{ ...bob, email }])).toBe(`Users file: ${email}: email must not start or end with a space`);
    },
  );

  it('accepts an email of 254 characters and rejects 255', () => {
    const at = (length: number) => `${'a'.repeat(length - '@example.com'.length)}@example.com`;
    expect(parseUsersFile([{ ...bob, email: at(254) }])[0].email).toBe(at(254));
    expect(errorFor([{ ...bob, email: at(255) }])).toBe(`Users file: ${at(255)}: email must be at most 254 characters`);
  });

  it('accepts a name of 100 characters and rejects 101', () => {
    expect(parseUsersFile([{ ...bob, name: 'n'.repeat(100) }])[0].name).toBe('n'.repeat(100));
    expect(errorFor([{ ...bob, name: 'n'.repeat(101) }])).toBe(
      'Users file: bob@example.com: name must be at most 100 characters',
    );
  });

  it('trims spaces around the name, which the header shows', () => {
    expect(parseUsersFile([{ ...bob, name: '  Bob  ' }])[0].name).toBe('Bob');
  });

  it.each([undefined, '', '  '])('rejects a missing name (%j)', (name) => {
    expect(errorFor([{ ...bob, name }])).toBe('Users file: bob@example.com: name is missing');
  });

  it.each([undefined, ''])('rejects a missing password (%j)', (password) => {
    expect(errorFor([{ ...bob, password }])).toBe('Users file: bob@example.com: password is missing');
  });

  it('reports the first bad entry when several are bad', () => {
    expect(errorFor([{ ...alice, role: 'manager' }, { ...bob, password: 'x' }])).toBe(
      'Users file: alice@example.com: role must be "admin" or "user"',
    );
  });

  it.each([{}, 'users', null])('rejects a file that is not an array (%j)', (json) => {
    expect(errorFor(json)).toBe('Users file: must be a JSON array of users');
  });

  it('rejects an empty file, so the users are not all removed', () => {
    expect(errorFor([])).toBe('Users file: must list at least one user');
  });
});
