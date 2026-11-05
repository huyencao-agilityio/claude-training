import 'reflect-metadata';
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { hashPassword } from './users/password';
import { User } from './users/user.entity';
import { parseUsersFile, UsersFileError } from './users/users-file';
import { UsersService } from './users/users.service';

// Loads the users file and replaces all users with its entries. Tasks are never touched
// (`npm run seed` loads the sample tasks separately).
// Usage: npm run seed:users [path]   (default: data/users.json)
async function seedUsers() {
  const path = resolve(process.argv[2] ?? 'data/users.json');

  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new UsersFileError(`Users file: cannot read ${path}: ${(err as Error).message}`);
  }

  // The whole file is checked and hashed before the database is opened, so a bad file changes nothing
  const entries = parseUsersFile(json);
  const hashed = await Promise.all(
    entries.map(async ({ password, ...user }) => ({ ...user, passwordHash: await hashPassword(password) })),
  );

  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  try {
    const { loaded, removed } = await new UsersService(dataSource.getRepository(User)).replaceAll(hashed);
    console.log(`Loaded ${loaded} users (${removed} removed)`);
  } finally {
    await dataSource.destroy();
  }
}

seedUsers().catch((err) => {
  // Only the message: a database error object also carries the query parameters, which would
  // print every email and password hash of the file. A bad file needs no stack trace either.
  console.error(err instanceof UsersFileError ? err.message : `Loading users failed: ${(err as Error).message}`);
  process.exit(1);
});
