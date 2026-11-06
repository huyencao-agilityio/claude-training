# Task Tracker (Day 2 practice)

A small NestJS + PostgreSQL task tracker that goes with the tickets in [`dojo-ai-training/exercises/day-2-ticket-analysis/tickets`](../dojo-ai-training/exercises/day-2-ticket-analysis/tickets).

## Requirements

- Node.js 22+
- Docker (for PostgreSQL)

## Run it

```bash
npm install
cp .env.example .env   # optional, defaults match docker-compose
npm run db:up          # PostgreSQL 17 on localhost:5433
npm run seed           # ~2,500 sample tasks (wipes the tasks table)
npm run seed:users     # sample accounts from data/users.json (never touches tasks)
npm run fix:due-dates  # once after upgrading: rounds old due dates to 00:00 UTC (safe to re-run)
npm run start:dev      # http://localhost:3000
```

Open http://localhost:3000 for the web UI and log in with a sample account: `admin@example.com` (admin), `alice@example.com` or `bob@example.com` (user), all with password `Passw0rd`. Stop the database with `npm run db:down`.

## Users and login

- `npm run seed:users [path]` loads a users file (default `data/users.json`): a JSON array of `{ email, name, role, password }`. It replaces all users: users in the file are added or updated by email, users missing from the file are marked removed and can't log in. Tasks are never changed.
- The whole file is checked first; any bad entry stops the script with an error naming it, and the users stay as they were. Rules: email required, lowercase and unique; name required; role `admin` or `user`; password 8 to 12 characters with at least 1 uppercase letter, 1 lowercase letter and 1 digit. Passwords are stored hashed (scrypt).
- A login lasts 24 hours from the moment of login and is kept in an HttpOnly `session` cookie, so it survives closing the browser.
- Environment variables (optional): `SESSION_SECRET` signs the session cookie. Locally a dev-only default is used when it is unset; with `NODE_ENV=production` the app refuses to start unless it is set to at least 32 characters. `SESSION_TTL_SECONDS` sets how long a login lasts (default `86400`); set it low, e.g. `60`, to test expiry.

## Tests

Jest + ts-jest. Specs live next to the code in `src/`.

```bash
npm test                                      # unit tests (*.spec.ts), mocked repository, no database needed
npm test -- src/tasks/tasks.service.spec.ts   # one file
npm test -- -t "throws NotFoundException"     # one test by name

npm run db:up                                 # start PostgreSQL first
npm run test:db                               # DB tests (*.db.spec.ts) against the real PostgreSQL
```

DB tests run each test in a transaction that is rolled back, so they don't change your seeded data. `npm test` skips them.

## API

Every endpoint except `POST /auth/login` needs a login and returns `401` without one (`"error": "SessionExpired"` when the login is older than 24 hours).

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` → `200 { name, role }` and the `session` cookie; `401` "Email or password is incorrect." |
| GET | `/auth/me` | The logged-in user: `{ name, role }` |
| GET | `/tasks?tab=&priority=&search=&status=&page=&limit=` | List tasks one page at a time: `{ items, total, page, limit }`, High → Medium → Low, then newest first. `tab`: `active` (not done, due today or later or no due date), `overdue` (not done, due before 00:00 UTC today) or `done`; omitted = every task. `priority`: `high`, `medium`, `low`. `search` matches part of the title, case-insensitive. `status`: `todo`, `in_progress`, `done`; ignored when `tab=done`. `page` is 1–10000 (default 1); `limit` is 1–100 (default 20). Invalid or out-of-range values return 400 |
| GET | `/tasks/export?tab=&priority=&search=&status=` | The same tasks in the same order as the list, without paging, as CSV; `priority` is the last column |
| GET | `/tasks/:id` | One task |
| POST | `/tasks` | Admin only. `{ title, description?, status?, priority?, dueDate? }`; `priority` defaults to `medium`; `dueDate` is an ISO 8601 date or timestamp, saved as 00:00 UTC of its UTC day (no offset = UTC) |
| PATCH | `/tasks/:id` | Any of the fields above. A `user` may change only `priority` |
| DELETE | `/tasks/:id` | |

Each task in a response includes a computed `isOverdue` flag.

## Layout

```
src/
  main.ts              bootstrap, validation pipe, serves public/
  app.module.ts        config + TypeORM
  data-source.ts       DB connection options (shared with the seed script)
  seed.ts              sample tasks
  seed-users.ts        loads the users file
  fix-due-dates.ts     one-off: rounds due dates saved as local midnight to 00:00 UTC
  auth/                login, session cookie, global auth guard
  users/               user entity, users file checks, password hashing
  tasks/               entity, DTOs, service, controller
data/users.json        sample accounts (made up)
public/                web UI (plain HTML/JS)
```

The schema is created automatically from the entity (`synchronize: true`, dev only).
