# Plan: Login

- Ticket: https://gitlab.asoft-python.com/huyen.cao/claude-training/-/work_items/13
- Analysis: docs/analyze/13-login.md
- Branch: `feat/login`
- Status: Implemented (2026-11-05)

Today anyone who opens task-tracker can see and change every task. This ticket adds users loaded from a JSON users file, login with email + password, a 24-hour session that survives a browser restart, a `401` on every task endpoint without a valid login, and the user's name and role in the header. Roles are only loaded and shown; permissions per role are T4 (#16).

Choices made with the developer:
- Session: a signed token in an **HttpOnly cookie**.
- Crypto: **`node:crypto` only** (scrypt for passwords, HMAC-SHA256 for the token). No new dependency.
- Reloading the users file **keeps rows**: users are upserted by email (so their id stays), and users missing from the file get `removed_at` set and can't log in. This meets "removed, can no longer log in" and leaves T3 AC3.15 (removed user's name still shown on tasks) a plain foreign key.

## AC → change

| AC | Behaviour change | Files | Unit test |
|---|---|---|---|
| AC1.1 | `npm run seed:users` loads `data/users.json`: upserts every entry by email with a scrypt hash, sets `removed_at` on users not in the file, all in one transaction. Never touches tasks. | `src/users/user.entity.ts`, `src/users/users.service.ts`, `src/users/password.ts`, `src/seed-users.ts`, `data/users.json`, `src/data-source.ts`, `package.json` | `users.service.spec.ts` (upsert, mark removed, no task repo use), `password.spec.ts` (hash ≠ plain, salted) |
| AC1.2 | The script checks the whole file before any DB write. The first bad entry stops it with exit code 1 and an error naming the email, or `entry <n>` when the email is missing. | `src/users/users-file.ts`, `src/seed-users.ts` | `users-file.spec.ts` (TC-02, TC-03, TC-40, TC-41, TC-57, TC-58, TC-59, missing email / name / password, not an array, empty array) |
| AC1.3 | `POST /auth/login` with a correct email + password sets the session cookie and returns `{ name, role }`; the UI shows the task list. | `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`, `src/auth/dto/login.dto.ts`, `src/auth/session-token.ts`, `public/*` | `auth.service.spec.ts`, `auth.http.spec.ts` |
| AC1.4 | Wrong password, unknown email, uppercase email or removed user → `401` "Email or password is incorrect.". The email is compared exactly as typed (no trim, no lowercasing). | `src/auth/auth.service.ts`, `src/users/users.service.ts` | `auth.service.spec.ts` (4 cases, same message) |
| AC1.5 | The login form doesn't send when a field is empty; the empty field gets a red border and "Required". The API also rejects empty fields with `400`. | `public/index.html`, `public/app.js`, `public/styles.css`, `src/auth/dto/login.dto.ts` | `login.dto.spec.ts` (empty → 400; email kept as typed) |
| AC1.6 | A global `AuthGuard` returns `401` with no task data on all 6 task endpoints when there's no valid session. The UI shows only the login screen until `GET /auth/me` succeeds. | `src/auth/auth.guard.ts`, `src/auth/auth.module.ts`, `src/app.module.ts`, `public/*` | `auth.http.spec.ts` (TC-09: 6 endpoints, no repository call) |
| AC1.7 | A token older than 24 h → `401` with `error: "SessionExpired"` and "Your login has expired. Please log in again."; the handler doesn't run. The UI shows the login screen with that message and, after login, the default list (page 1, filters reset). | `src/auth/session-token.ts`, `src/auth/auth.guard.ts`, `public/app.js` | `session-token.spec.ts` (expired), `auth.http.spec.ts` (expired → 401, `POST /tasks` not saved) |
| AC1.13 | The header shows "<name> (<role>)", e.g. "Alice (user)", from `GET /auth/me` or the login response. | `public/index.html`, `public/app.js`, `src/auth/auth.controller.ts` | `auth.http.spec.ts` (`/auth/me` returns name + role) |
| AC1.18 | The cookie is persistent (`Max-Age` 30 days) so it survives a browser restart. The token inside carries the real 24 h expiry. | `src/auth/auth.service.ts` | `auth.http.spec.ts` (`Set-Cookie` has `HttpOnly`, `Max-Age`, `Path=/`) |

## API contract

**`POST /auth/login`** (public)
- Body: `{ "email": string, "password": string }`, both required and non-empty, no trimming.
- `200` → `{ "name": "Alice", "role": "user" }` + `Set-Cookie: session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
- `401` → `{ "statusCode": 401, "message": "Email or password is incorrect.", "error": "Unauthorized" }`: wrong password, unknown email, email with an uppercase letter, removed user.
- `400` → class-validator message when a field is missing or empty.

**`GET /auth/me`** (needs a session)
- `200` → `{ "name": "Alice", "role": "user" }`

**Every task endpoint and `/auth/me` without a valid session**: `GET /tasks`, `GET /tasks/export`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- No cookie, bad signature, unknown or removed user → `401` `{ "statusCode": 401, "message": "Unauthorized" }`
- Token older than the TTL → `401` `{ "statusCode": 401, "message": "Your login has expired. Please log in again.", "error": "SessionExpired" }`
- The guard runs before validation and the handler: nothing is read, written or streamed.

**Session token**: `base64url(JSON {sub: userId, iat, exp}) + "." + base64url(HMAC-SHA256)`. `exp = iat + SESSION_TTL_SECONDS` (default `86400`, from login time, not from last action, per A-22). Secret: `SESSION_SECRET`, falling back to a dev-only constant like `src/data-source.ts` does for the DB. Both added to `.env.example`.

**Seed commands**
- `npm run seed`: unchanged, wipes tasks and inserts sample tasks.
- `npm run seed:users [path]` → `ts-node src/seed-users.ts`, default `data/users.json`. Prints `Loaded <n> users (<m> removed)`. Bad file: prints the error, exit code `1`, DB unchanged.
- Error texts (one per entry, first bad entry wins):
  - `Users file: <email>: password must be 8 to 12 characters with at least 1 uppercase letter, 1 lowercase letter and 1 digit`
  - `Users file: <email>: email is used more than once`
  - `Users file: <email>: email must be lowercase`
  - `Users file: <email>: role must be "admin" or "user"`
  - `Users file: <email>: name is missing` / `password is missing`
  - `Users file: entry <n>: email is missing` (1-based position)
  - `Users file: must be a JSON array of users`
  - `Users file: must list at least one user` (empty array, see Open questions)

## Data

- New entity `User` → table `users`: `id` uuid PK, `email` varchar(254) unique, `name` varchar(100), `role` varchar(10) (`USER_ROLES = ['admin', 'user'] as const`), `password_hash` text, `removed_at` timestamptz nullable, `created_at` / `updated_at` timestamptz.
- Added to `entities` in `src/data-source.ts`. `synchronize: true` creates the new `users` table on the next start; the `tasks` table doesn't change.
- Password hash format: `scrypt$<salt b64>$<hash b64>` (16-byte random salt, 64-byte key), checked with `timingSafeEqual`. An unknown email still runs one scrypt against a dummy hash so the response time doesn't reveal which emails exist.
- `data/users.json` (sample, made-up): `admin@example.com` "Admin" admin, `alice@example.com` "Alice" user, `bob@example.com` "Bob" user, all `Passw0rd` (ticket pack section 7).
- Reload: upsert by email (name, role, hash; `removed_at = null`), then `removed_at = now()` for active users not in the file. A user who is added back gets their old row and id again.

## Code layout

- `src/users/`: `user.entity.ts`, `users.module.ts` (exports `UsersService`), `users.service.ts` (`findActiveByEmail`, `findActiveById`, `replaceAll(entries)`), `users-file.ts` (pure `parseUsersFile(json): UserEntry[]`, like `tasks/tasks-csv.ts`), `password.ts` (`hashPassword`, `verifyPassword`).
- `src/auth/`: `auth.module.ts` (imports `UsersModule`, registers `AuthGuard` as `APP_GUARD`), `auth.controller.ts`, `auth.service.ts`, `auth.guard.ts` (reads the `session` cookie from `req.headers.cookie`; `@Public()` decorator to skip it), `session-token.ts` (`signSession`, `verifySession` → `ok | expired | invalid`), `dto/login.dto.ts`.
- `src/seed-users.ts`: reads and parses the file, then `new UsersService(dataSource.getRepository(User)).replaceAll(...)`.
- The login handler is `return this.authService.login(dto, res)` with `@Res({ passthrough: true })`; the service sets the cookie, so the controller stays one line.
- `public/`: `index.html` gets a login section (Email `type="text"`, Password `type="password"`, "Log in" button, one message line, `novalidate`) and an app section, both `hidden` at first, plus `<span id="current-user">` next to the `<h1>`. `app.js` gets an `apiFetch` wrapper: on `401` it shows the login screen (with the expired message when `error === "SessionExpired"`) and resets the page and filters. It's used by `fetchTasks` and `POST /tasks`. The "Log in" button is disabled while the request is in flight.
- Docs: add `npm run seed:users` to `task-tracker/CLAUDE.md` (Build / run) and `task-tracker/README.md`.

## Key code

Only the parts where a wrong design is costly or security-relevant. The final code may differ in naming and details; any change in behaviour goes under Deviations.

**1. `User` entity** (`src/users/user.entity.ts`): T3 adds a foreign key to this table.

```ts
export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  role: UserRole;

  // Never returned by the API: AuthService only returns { name, role }
  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  // Set when a reload of the users file no longer lists this user; they can't log in
  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**2. Session token** (`src/auth/session-token.ts`): the signature is checked before the payload is parsed, and the expiry is checked after that.

```ts
export type SessionCheck =
  | { status: 'ok'; userId: string }
  | { status: 'expired' }
  | { status: 'invalid' };

const sign = (body: string) =>
  createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

export function signSession(userId: string, now = Date.now()): string {
  const payload = { sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string, now = Date.now()): SessionCheck {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { status: 'invalid' };

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { status: 'invalid' };
  }

  let payload: { sub?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { status: 'invalid' };
  }
  if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
    return { status: 'invalid' };
  }
  // AC1.7: exactly 24 hours after login counts as expired
  if (now >= payload.exp) return { status: 'expired' };
  return { status: 'ok', userId: payload.sub };
}
```

**3. `AuthGuard`** (`src/auth/auth.guard.ts`), registered as `APP_GUARD` in `AuthModule`, so new endpoints (T2 to T4) are protected by default.

```ts
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
    if (isPublic) return true; // only POST /auth/login

    const req = context.switchToHttp().getRequest<Request & { user?: User }>();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException();

    const session = verifySession(token);
    if (session.status === 'expired') {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Your login has expired. Please log in again.',
        error: 'SessionExpired',
      });
    }
    if (session.status === 'invalid') throw new UnauthorizedException();

    // null when a reload of the users file removed this user (AC1.1)
    const user = await this.users.findActiveById(session.userId);
    if (!user) throw new UnauthorizedException();

    req.user = user;
    return true;
  }
}
```

**4. Reload users in one transaction** (`UsersService.replaceAll`): the file is already validated and the passwords hashed before this runs, so a bad file never opens a transaction (AC1.2).

```ts
async replaceAll(entries: HashedUserEntry[]): Promise<{ loaded: number; removed: number }> {
  return this.users.manager.transaction(async (manager) => {
    // Same email = same row and id, so T3's assignee links survive a reload
    await manager.upsert(
      User,
      entries.map((e) => ({ ...e, removedAt: null })),
      ['email'],
    );
    const result = await manager
      .createQueryBuilder()
      .update(User)
      .set({ removedAt: () => 'now()' })
      .where('removed_at IS NULL')
      .andWhere('email NOT IN (:...emails)', { emails: entries.map((e) => e.email) })
      .execute();
    return { loaded: entries.length, removed: result.affected ?? 0 };
  });
}
```

**5. `apiFetch` in the UI** (`public/app.js`): every API call goes through it, so a `401` in the middle of any action leads to the login screen.

```js
// A 401 means the login is missing, invalid or expired
async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status !== 401) return res;

  const body = await res.json().catch(() => ({}));
  showLogin(body.error === 'SessionExpired' ? body.message : '');
  return null; // the caller stops: nothing is shown or saved
}

function showLogin(message) {
  // AC1.7: after logging in again the user gets the default list
  appliedFilters = new URLSearchParams();
  currentPage = 1;
  filterForm.reset();
  rows.innerHTML = '';
  currentUser.textContent = '';
  appSection.hidden = true;
  loginSection.hidden = false;
  loginMessage.textContent = message;
}
```

## Tests

Unit tests (`npm test`, no DB):
- `users/users-file.spec.ts`: valid 3-entry file; 8 and 12 chars accepted (TC-41); `password1`, `Pass0rd`, `Passw0rd12345`, no digit (TC-02, TC-03, TC-40); duplicate (TC-57); role `manager` (TC-58); `Bob@example.com` (TC-59); missing email → `entry <n>`; missing name; missing password; not an array; empty array.
- `users/password.spec.ts`: hash ≠ plain, verify true/false, same password gives two different hashes.
- `users/users.service.spec.ts`: `replaceAll` upserts by email inside one transaction and marks the missing ones removed; `findActiveByEmail` matches exactly and skips removed users.
- `auth/session-token.spec.ts`: round trip; tampered payload or signature → invalid; past `exp` → expired; malformed → invalid.
- `auth/auth.service.spec.ts`: correct login sets the cookie and returns `{ name, role }`; wrong password, unknown email, `Alice@example.com` and removed user each give the same `401` message.
- `auth/dto/login.dto.spec.ts`: empty or missing email / password → `400`; email not trimmed or lowercased.
- `auth/auth.http.spec.ts` (real HTTP like `tasks.controller.spec.ts`; app with `TasksController`, `AuthController`, `APP_GUARD`, mocked repositories): the 6 task endpoints without a cookie → `401` and no repository call (TC-09); expired token → `SessionExpired` and `POST /tasks` doesn't save (AC1.7); removed user's token → `401`; valid cookie → `200`; login `Set-Cookie` attributes; `/auth/me`.
- The existing `tasks.controller.spec.ts` builds its own module without `AppModule`, so the global guard doesn't apply there and it stays unchanged.

Commands: `npx tsc --noEmit`, `npm test`, then `verify-changes`.

Left for QA (E2E / manual): seed against a real DB (TC-01, TC-56, TC-73), login screen behaviour (TC-04 to TC-08, TC-60), expiry with `SESSION_TTL_SECONDS=60` (TC-10), header (TC-51), browser restart (TC-74).

## Out of scope and risks

- Out of scope (from the ticket): sign-up, "Log out", forgot / change password, lockout, "remember me", user management UI, role permissions (T4 / #16). No email format check beyond the ticket's rules.
- MR !2 (open) changes `public/app.js`, `tasks.controller.ts`, `tasks.controller.spec.ts` and `package.json`. Expect conflicts with whichever merges second.
- The pack `v0.9` is uncommitted on another branch (analysis gap 2). The plan uses the TC IDs from the issue and from that working copy.
- `SameSite=Lax` cookie with no CSRF token: state-changing calls are JSON `fetch` from the same origin. Acceptable for this training app; note it in the MR's Risk section.
- The dev-default `SESSION_SECRET` must be overridden outside local dev.
- After the TTL passes, an action in an open tab gets `401` and the action is lost (accepted in Q-29).

## Open questions

- **Empty users file (`[]`)**: the ticket doesn't cover it. Read literally, it would remove every user, so nobody could log in, and `NOT IN ()` in Key code 4 is invalid SQL. Recommendation: `parseUsersFile` rejects it with `Users file: must list at least one user`, so the DB stays unchanged like any other bad file (AC1.2). Answer: confirmed by the developer (2026-11-05).

## Deviations

None.
