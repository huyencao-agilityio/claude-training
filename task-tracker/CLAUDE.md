# CLAUDE.md

NestJS 11 + TypeORM + PostgreSQL 17 task tracker, the practice codebase for `../dojo-ai-training/exercises/`. Some bugs are there on purpose: only fix a bug when the task asks for it.

## Build / run

Requires Node.js 22+ and Docker. `.env` is optional; `src/data-source.ts` falls back to the `docker-compose.yml` defaults.

```bash
npm run db:up        # PostgreSQL on localhost:5433 (not 5432)
npm run seed         # wipes the tasks table, inserts ~2,500 tasks
npm run seed:users   # loads data/users.json into users (never touches tasks); log in as alice@example.com / Passw0rd
npm run start:dev    # http://localhost:3000 (API + web UI in public/)
npm run build        # nest build -> dist/
npx tsc --noEmit     # type-check (no linter yet)
npm test             # Jest; one file: npm test -- <path>, one test: -t "<name>"
```

## Conventions

- Validate input with DTOs + class-validator. The global `ValidationPipe({ whitelist: true })` silently drops any field without a decorator.
- Business logic lives in `TasksService`; controllers only call the service.
- Services return `TaskResponse` (entity + computed `isOverdue`, not stored). List methods return a page of them: `{ items: TaskResponse[], total, page, limit }` (`TaskPage`).
- New entities go in the `entities` list in `src/data-source.ts` (shared by the app and `src/seed.ts`).
- Every bug fix has a test that fails first, then passes. Every feature has tests for its edge cases and validation errors.
- Specs sit next to the code as `*.spec.ts` and mock the repository (no DB). Run them and report the real result before saying you're done.

## Never do

- Never edit a migration that has already run. There are none yet: the schema comes from `synchronize: true`, so editing `task.entity.ts` changes the table on the next start.
- Never commit `.env` or read its contents; use `.env.example` for new variables.
- Never change code outside the task's scope, including the intentional bugs.
