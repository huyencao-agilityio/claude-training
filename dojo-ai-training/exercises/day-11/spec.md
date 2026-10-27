# Spec: Login required to view tasks

- **Source:** [intent.md](intent.md) (all open questions answered by the product owner)
- **Target codebase:** [task-tracker](../../../task-tracker) (NestJS 11, TypeORM, PostgreSQL 17, static UI in `public/`)
- **Status:** Ready for engineering review. Local use only; deployment and HTTPS are out of scope.
- **Decisions live in `intent.md`.** If an answer changes there, update section 2 here.

**Purpose:** a visitor must log in with email + password before seeing any task data. Every task has an owner and only the owner can change or delete it. Accounts come from the seed script or an add-user script; there is no sign-up.

```
Browser                         task-tracker (NestJS)                  PostgreSQL
  │  GET /  (static UI, public)        │                                   │
  │  GET /auth/session ───────────────▶│ verify cookie                     │
  │◀─────────────── 401 ───────────────│                                   │
  │  show login form                   │                                   │
  │  POST /auth/login {email,password}▶│ blocked? → 429                    │
  │                                    │ find user, verify hash ──────────▶│ users
  │◀── 204 + Set-Cookie (HttpOnly) ────│                                   │
  │  GET /tasks (cookie sent) ────────▶│ AuthGuard ok → TasksService ─────▶│ tasks
  │  PATCH /tasks/:id ────────────────▶│ guard ok, owner? no → 403         │
  │  POST /auth/logout ───────────────▶│ clear cookie                      │
```

---

## 1. Scope

### In scope

1. A `users` table; 10 seeded users; a command-line script to add a user.
2. `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`.
3. A guard that makes every `tasks` endpoint (including `GET /tasks/export`) return `401` without a valid login.
4. Task ownership: an owner on every task, set on create, checked on update and delete (`403`), made-up owners for existing tasks in the seed.
5. A per-email block: 5 wrong passwords block that email for 10 minutes.
6. Login form, logged-in / logged-out states and a logout button in `public/`.
7. Tests, `.env.example` entries and docs for the above.

### Out of scope (from the intent)

Sign-up, forgot / change password, email verification, roles (e.g. admin), "only my tasks" view, showing task owners in the UI, social login / SSO, deployment and HTTPS.

## 2. Decisions applied

| Decision (from intent.md) | Value used |
|---|---|
| Build login in task-tracker | Yes, own `users` table, hashed passwords |
| Session length | 4 hours, fixed (`SESSION_TTL_HOURS=4`) |
| Unauthenticated API calls | `401` |
| Seed users | 10, made-up: `user01@example.com` … `user10@example.com` |
| Wrong-password block | 5 wrong passwords per **email** → blocked 10 minutes |
| Blocked response | Generic message + "try again in 10 minutes", also for unknown emails |
| Task owner | Every task; creator on create; seed spreads existing tasks across the 10 users |
| Who can update / delete | Owner only; others get `403` |
| UI shows owner | No |
| Adding real users | Command-line script |
| HTTPS / deployment | Not needed now (local only) |

**One assumption not in the intent:** a successful login resets the wrong-password count for that email (section 4.5).

## 3. Policy sources

The product owner confirmed that **no brand, security or UX policies exist**. Nothing in the repo or the available tools defines one either (the available skills such as `security-review` check code; they do not hold policy). So this spec is based on:

| Area | Basis |
|---|---|
| Visual / brand | Existing tokens and components in [styles.css](../../../task-tracker/public/styles.css) (blue `#1d4ed8`, `.card`, `.field`, `.message.error`), for consistency only |
| UX | The existing form pattern (stacked labelled fields, inline `.message`) plus basic accessibility practice (labels, `autocomplete`, `role="alert"`, visible focus) |
| Security | The intent's constraints plus common practice (OWASP ASVS / cheat sheets): password hashing, cookie flags, generic errors, brute-force limits |
| Code | [task-tracker/CLAUDE.md](../../../task-tracker/CLAUDE.md): DTO validation, logic in services, specs next to code, `.env.example`, no secrets in the repo |

Run `/security-review` on the finished change. It checks the code, not any policy.

## 4. Requirements and design

### 4.1 Data model

**New entity `User`** in `src/auth/user.entity.ts`, added to the `entities` list in [data-source.ts](../../../task-tracker/src/data-source.ts#L12) (shared by the app and the seed).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | `PrimaryGeneratedColumn('uuid')`, same as `Task` |
| `email` | varchar(254), unique | Stored trimmed and lower-cased |
| `password_hash` | varchar | `select: false`, so it is never loaded by accident |
| `created_at` | timestamptz | `CreateDateColumn`, same as `Task` |

Only these fields are stored (intent: no profile data).

**Change to `Task`** ([task.entity.ts](../../../task-tracker/src/tasks/task.entity.ts)): add `ownerId` (`owner_id`, uuid) with a `ManyToOne` relation to `User`, `onDelete: 'RESTRICT'`.

- The column is **nullable at the database level** (concern C5): `synchronize: true` cannot add a `NOT NULL` column to a table that already has rows, so the app would fail to start on any existing dev database. The seed fills it for every row.
- **A task with no owner is editable by nobody** (`403`), so a missing owner fails safe.
- Add an index on `owner_id`.

### 4.2 Password hashing

- Use Node's built-in `crypto.scrypt` (no native dependency), random 16-byte salt per user.
- Store as one string, e.g. `scrypt$<N>$<r>$<p>$<salt-b64>$<hash-b64>`, so the parameters can be raised later.
- Compare with `crypto.timingSafeEqual`.
- For an unknown email, still run one scrypt against a fixed dummy hash so response time does not reveal which emails exist.
- Keep it behind a `PasswordService` so the algorithm can be swapped (e.g. argon2id) later.

### 4.3 Auth API

New `AuthModule` in `src/auth/`: `auth.controller.ts`, `auth.service.ts`, `password.service.ts`, `login-throttle.service.ts`, `auth.guard.ts`, `public.decorator.ts`, `current-user.decorator.ts`, `dto/login.dto.ts`. Logic lives in the services; controllers only call them (repo convention).

| Method + path | Auth | Request | Success | Failure |
|---|---|---|---|---|
| `POST /auth/login` | public | `{ email, password }` | `204` + `Set-Cookie` | `401 { "message": "Invalid email or password" }` for wrong email **or** wrong password; `429` when the email is blocked (4.5); `400` for a malformed body |
| `POST /auth/logout` | public | none | `204`, cookie cleared | none (always `204`) |
| `GET /auth/session` | required | none | `204` | `401` |

Rules:

- **No user data in responses.** Login returns `204` with no body. No endpoint returns an email or hash.
- **`LoginDto`:** `email` is `@IsEmail()` + `@MaxLength(254)`; `password` is `@IsString()` + `@MinLength(1)` + `@MaxLength(128)` (the upper bound stops hashing huge inputs). The global `ValidationPipe({ whitelist: true })` in [main.ts](../../../task-tracker/src/main.ts#L9) silently drops any field without a decorator.
- **Email handling:** trim and lower-case before lookup and before counting attempts.
- **Guard:** register `AuthGuard` globally with `APP_GUARD` so new endpoints are protected by default. Mark only login and logout with `@Public()`. On success the guard puts `{ id }` on the request; `@CurrentUser()` reads it.
- **Static files are not behind the guard.** `useStaticAssets` ([main.ts](../../../task-tracker/src/main.ts#L10)) serves `index.html`, `app.js` and `styles.css` before Nest guards run. They hold no task data, and the login form must load before login.

### 4.4 Session

- After a successful login the server sets a signed token in a cookie:
  - Token: JWT (`@nestjs/jwt`), payload `{ sub: <user id>, exp }` only. No email in the token.
  - Cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age = SESSION_TTL_HOURS * 3600` (4 hours), `Secure` when `NODE_ENV=production`.
- Logout clears the cookie (see concern C3: the token stays valid until it expires).
- CSRF: `SameSite=Strict` plus JSON-only mutating endpoints. No CSRF token. Cookie parsing needs `cookie-parser`.
- `JWT_SECRET` (new env var, placeholder in `.env.example`):
  - `NODE_ENV=production` and no `JWT_SECRET` → the app refuses to start.
  - Otherwise, no `JWT_SECRET` → generate a random one at boot and log a warning (never the secret). Sessions then end on restart, which is fine for local use and keeps `.env` optional as the CLAUDE.md says.
- A token for a user that no longer exists is rejected (the guard checks the user exists on each request, one primary-key lookup).

### 4.5 Wrong-password block (per email)

`LoginThrottleService`, in memory (single instance, local use). Key = normalized email, whether or not an account exists.

| Event | Effect |
|---|---|
| Wrong password or unknown email | `failures += 1`. On the 5th, `blockedUntil = now + 10 min` and this response is already the block response |
| Attempt while blocked (even with the correct password) | `429`, no password check, count unchanged |
| Block expires | Count and block cleared |
| Successful login | Count cleared (**assumption**, section 2) |
| No failure for 10 minutes | Count cleared (so old mistakes do not add up forever) |

- Block response: status `429`, header `Retry-After: <seconds>`, body `{ "message": "Invalid email or password. Too many attempts, try again in 10 minutes." }`. It is the same for existing and unknown emails.
- Constants (`MAX_FAILURES = 5`, `BLOCK_MINUTES = 10`) in one place, not env vars.
- Purge expired entries on write so unknown-email attempts cannot grow memory without bound; also cap the map size (e.g. 10,000 entries, drop oldest).
- Restarting the server clears all blocks (concern C4).

### 4.6 Task ownership

Changes to [tasks.service.ts](../../../task-tracker/src/tasks/tasks.service.ts) and [tasks.controller.ts](../../../task-tracker/src/tasks/tasks.controller.ts#L24):

- `create(dto, userId)` ([line 117](../../../task-tracker/src/tasks/tasks.service.ts#L117)): set `ownerId = userId` from the session. It is never read from the request body (not on `CreateTaskDto`, so `whitelist` drops it).
- `update(id, dto, userId)` ([line 127](../../../task-tracker/src/tasks/tasks.service.ts#L127)) and `remove(id, userId)` ([line 139](../../../task-tracker/src/tasks/tasks.service.ts#L139)): load the task; `404` if missing; `403` (`ForbiddenException`) if `task.ownerId !== userId` (including a null owner); otherwise proceed as today. Check 404 before 403, as everyone may see every task anyway.
- `findAll`, `findOne`, `exportCsv`: unchanged apart from being behind the guard; every logged-in user sees all tasks.
- **`ownerId` is not returned.** Strip it in `toResponse` ([line 146](../../../task-tracker/src/tasks/tasks.service.ts#L146)) so `TaskResponse` stays "entity + `isOverdue`" without exposing user ids.
- The controller passes `@CurrentUser()` to the three methods above and nothing else.

### 4.7 Add-user script

`src/add-user.ts`, run as `npm run user:add -- <email>` (new script in `package.json`, like `seed`).

- Prompts for the password without echoing it; asks twice. Minimum 8 characters (the script only; login itself accepts any non-empty password so seed users work).
- Validates the email, rejects a duplicate, stores the scrypt hash via `PasswordService`.
- Prints only "User created"; never the email or password. It needs only the database, not `JWT_SECRET`.
- The product owner decides who may run it; the script has no authentication of its own, as it is a local command.

### 4.8 Seed

Extend [seed.ts](../../../task-tracker/src/seed.ts):

- Insert the 10 users **before** the tasks, upserting by email. Do not clear the `users` table the way `repo.clear()` ([line 30](../../../task-tracker/src/seed.ts#L30)) clears `tasks`, or each re-seed would delete accounts added by the script.
- The shared password comes from `SEED_USER_PASSWORD` in `.env.example` (made-up value), not hard-coded.
- Give every inserted task an owner, round-robin across the 10 users (`users[i % 10]`), named tasks included.
- Refuse to run when `NODE_ENV=production`.
- Print only counts ("Seeded 10 users, 2505 tasks").

### 4.9 Web UI (`public/`)

Reuse the current look; add no new colours or fonts.

- **Structure:** in [index.html](../../../task-tracker/public/index.html) wrap the existing two task sections in `<div id="app" hidden>`, add `<section id="login" class="card" hidden>`, and a `Log out` button in the page header.
- **Login form** with the existing `form.stacked` + `.field` pattern:
  - `Email`: `<input type="email" name="email" autocomplete="username" required>`
  - `Password`: `<input type="password" name="password" autocomplete="current-password" required>`
  - Button `Sign in`, disabled while the request runs.
  - Errors in `<p class="message error" role="alert">`: show the API message for `401` and `429`; for network failure reuse "Could not reach the server".
  - Clear the password field after any failure. Never put credentials in the URL or the console.
- **On load:** call `GET /auth/session`; `204` shows `#app`, `401` shows `#login`. Show neither until it answers, so protected content never flashes.
- **Logout:** `POST /auth/logout`, then show the login form and clear the table.
- **Expired session:** any `fetch` in [app.js](../../../task-tracker/public/app.js#L54) (and `POST /tasks` at [line 134](../../../task-tracker/public/app.js#L134)) that gets `401` shows the login form with "Your session has expired. Please log in again."
- **Owners and edit/delete:** the UI today has **no edit or delete controls**, only list, search and create. So the `403` rule is enforced and testable through the API only. The UI shows no owner and gets no new controls (intent: UI shows no owner).
- **Accessibility:** visible `<label>` on every input, `role="alert"` on errors, existing focus outline kept, Enter submits.

### 4.10 Configuration

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | random per boot (non-production) | required when `NODE_ENV=production` |
| `SESSION_TTL_HOURS` | `4` | |
| `SEED_USER_PASSWORD` | placeholder in `.env.example` | made-up, local only |

New dependencies: `@nestjs/jwt`, `cookie-parser` (+ `@types/cookie-parser`). `package.json` has uncommitted changes in the working tree today; coordinate before adding these.

## 5. PII and security checklist

| Intent constraint | Where met |
|---|---|
| Passwords hashed, never stored or logged in plain text | 4.2; no body logging; scripts print only counts / "User created" |
| Store only what login needs | 4.1 (email, hash, id, timestamp) |
| Never log passwords, hashes or full emails | 4.3, 4.7, 4.8; a test checks a failed login writes no credentials to the logger |
| One generic login error | 4.3 (`401`), 4.5 (block text extends it identically for unknown emails), 4.2 (equal timing) |
| No API response exposes an email or hash | 4.3 (`204`), `select: false`, JWT has no email, `ownerId` stripped (4.6) |
| Per-email block | 4.5 |
| Made-up seed data | 4.8 |
| HTTPS once deployed | **Not part of this work** (local only). Re-check before any deployment (C1) |

## 6. Testing

Repo convention: specs next to the code, repository mocked (no DB), each new test fails first, real results reported.

- **`password.service.spec.ts`:** hash then verify OK; wrong password fails; two hashes of one password differ; malformed stored hash fails safely.
- **`auth.service.spec.ts`:** valid login returns a token; unknown email and wrong password give the **same** error; email trimmed and lower-cased; the unknown-email path still does a hash comparison.
- **`login-throttle.service.spec.ts`** (fake timers): 4 failures → still `401`; 5th failure → blocked (`429`, `Retry-After` set); correct password while blocked → still `429`; after 10 minutes → allowed again; success resets the count; failures older than 10 minutes expire; different emails are independent; `A@x.com` and `a@x.com` share one counter; an **unknown** email is blocked and answered exactly like a known one; memory cap drops the oldest entry.
- **`login.dto.spec.ts`:** missing, empty, non-email, over-long email and password; unknown fields dropped.
- **`auth.guard.spec.ts`:** no cookie, tampered token, expired token → `401`; valid token for an existing user → pass; token for a deleted user → `401`; `@Public()` route → pass.
- **`tasks.service.spec.ts`** (existing file, update signatures): `create` sets `ownerId` from the user id and ignores any owner in the body; `update` / `remove` by the owner succeed; by another user → `ForbiddenException`; task with null owner → `ForbiddenException`; missing task → `NotFoundException`; responses do not contain `ownerId`.
- **`tasks.controller.spec.ts`** (existing): add the user argument; plus one module-level check that `GET /tasks` and `GET /tasks/export` are rejected without a cookie.
- **Seed / add-user:** unit-test the pure parts (round-robin owner assignment, password and email validation, duplicate rejection). The DB parts are checked manually.
- **Manual checks, record real output in the MR:**
  - [ ] `curl -i localhost:3000/tasks` and `/tasks/export` → `401`
  - [ ] Login as a seed user, reuse the cookie jar on `/tasks` → `200`
  - [ ] Wrong password and unknown email return the same status and body
  - [ ] 5 wrong passwords → 5th returns `429`; the correct password immediately after is still `429`; the same for an unknown email
  - [ ] User A creates a task; `PATCH` and `DELETE` by user B → `403`; by A → success
  - [ ] After seeding, every task has an owner and the 10 users each own about 1/10 of the tasks
  - [ ] Cookie shows `HttpOnly` and `SameSite=Strict`; expires after 4 hours
  - [ ] Log out, reload → login form, no task data visible
  - [ ] Delete the cookie with the page open, click Search → expired-session message
  - [ ] `npm run user:add -- someone@example.com` creates a user that can log in

## 7. Rollout and impact

- **Breaking change for API clients.** Every `curl`, script or exercise that calls `/tasks` anonymously now gets `401`. Document the cookie-jar flow in the task-tracker `README.md`:
  `curl -c jar -H 'Content-Type: application/json' -d '{"email":"user01@example.com","password":"<SEED_USER_PASSWORD>"}' localhost:3000/auth/login`, then `curl -b jar localhost:3000/tasks`.
- **Existing dev databases:** run `npm run seed` after upgrading. Tasks created before this change have no owner until then (`403` on update / delete, still visible).
- Update [task-tracker/CLAUDE.md](../../../task-tracker/CLAUDE.md) (the seed now also creates users and owners; new env vars; the `user:add` script) and the index in [dojo-ai-training/README.md](../../README.md).
- **Suggested order of work** (each step a reviewable commit):
  1. `User` entity, `PasswordService`, seed users, specs
  2. `AuthService`, `AuthController`, `LoginDto`, specs
  3. Global guard, `@Public()`, `LoginThrottleService`, config, specs
  4. `Task.ownerId`, ownership checks, seed owners, spec updates
  5. UI login / logout / expired session
  6. `user:add` script, docs, `.env.example`

## 8. Areas of concern

None of these block the work. Each says what the spec does and what remains with the team.

**C1. HTTPS is not met, by decision.**
The intent requires HTTPS for credentials once deployed, and the product owner scoped this work to local use. The app serves plain HTTP and `Secure` is only set when `NODE_ENV=production`. Nothing here makes a deployment safe.
*Handling:* do not deploy this version. Before any deployment: HTTPS at the proxy or platform, `trust proxy` configured, `NODE_ENV=production`, a real `JWT_SECRET`.

**C2. Per-email block can be used to lock someone out.**
The product owner chose per email over per IP. Anyone who knows an address can keep it blocked indefinitely by failing 5 times every 10 minutes, and the real user cannot log in. There is no unlock path (no admin, no reset).
*Handling:* accepted as the chosen trade-off. Mitigation if it becomes a problem: add a per-IP limit on top, or an admin unlock (roles are out of scope).

**C3. Logout does not revoke the token.**
The session is a stateless JWT: logout clears the cookie, but a stolen token works until it expires (4 hours). Revoking needs a `sessions` table, which "keep it simple" argues against.
*Handling:* accepted; the short lifetime limits it. Upgrade path: store a session id and check it in the guard.

**C4. Blocks live in memory.**
Restarting the server clears every block, and multiple instances would each count separately.
*Handling:* fine for one local instance. Move the counter to the database before running more than one instance.

**C5. Adding the owner column to an existing table.**
With `synchronize: true` ([data-source.ts](../../../task-tracker/src/data-source.ts#L14)) a `NOT NULL` column cannot be added to a table with rows, so `owner_id` is nullable at the database level and "ownerless means nobody can edit" is enforced in code. That is weaker than a database guarantee. Also, editing entities can alter or drop columns, including `password_hash`, on the next start.
*Handling:* acceptable for a training app (CLAUDE.md marks `synchronize` as dev-only and there are no migrations yet). Introduce migrations, then make `owner_id` `NOT NULL`, before any real user data is stored.

**C6. Owner rule has no UI, and a shared seed password.**
The UI has no edit or delete, so the owner rule is only visible through the API. Separately, all seed users share one password from `.env.example`, so anyone who reads the repo can log in as any seed user on a machine where the seed ran.
*Handling:* the first is expected; if edit/delete are added to the UI later they must call the same endpoints and show `403` as an error message. For the second, the seed refuses to run in production, and real accounts are created with `user:add`.

**C7. Breaking change for existing API users and exercises.**
Section 7. Earlier course exercises that verify with anonymous `curl` stop working, as does `GET /tasks/export` without a cookie.
*Handling:* document the curl flow; tell exercise owners.

**C8. One assumption the product owner did not state.**
A successful login resets the wrong-password count (section 4.5). It is a one-line change in `LoginThrottleService` if the answer is different.
