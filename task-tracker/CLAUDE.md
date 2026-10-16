# CLAUDE.md

Small NestJS 11 + TypeORM + PostgreSQL 17 task tracker. It is the practice codebase for the exercises in `../dojo-ai-training/exercises/`. Some of its behavior is buggy on purpose, so only fix a bug when the task asks for it.

## Commands

Requires Node.js 22+ and Docker.

```bash
npm run db:up        # PostgreSQL on localhost:5433 (not 5432), waits until healthy
npm run seed         # wipes the tasks table, inserts ~2,500 tasks
npm run start:dev    # http://localhost:3000 (API + web UI), watch mode
npm run build        # nest build -> dist/
```

`.env` is optional. `src/data-source.ts` falls back to the same defaults as `docker-compose.yml`.

There is no linter or formatter set up yet. To type-check, run `npx tsc --noEmit`.

## Tests

Every bug fix and new feature includes tests:
- **Bug fix**: first write a test that reproduces the bug and fails. Then fix the code until the test passes.
- **New feature**: add tests for the new behavior, including the edge cases and validation errors in the ticket.
- Run the tests before saying the work is done, and report the actual result.

Jest + ts-jest, config in `package.json`. Specs live next to the code as `*.spec.ts` and mock the TypeORM repository (no database needed).

```bash
npm test                                  # all tests
npm test -- src/tasks/tasks.service.spec.ts   # one file
npm test -- -t "throws NotFoundException"     # one test by name
```

## Architecture

- **Shared DB config**: `dataSourceOptions()` in `src/data-source.ts` is used by both the Nest app (`TypeOrmModule.forRootAsync`) and the standalone `src/seed.ts` script, which loads env vars with `dotenv/config` and runs outside Nest. When you add an entity, add it to the `entities` list there.
- **No migrations**: `synchronize: true` builds the schema from the entity. Changing `task.entity.ts` changes the table on the next start.
- **Validation**: the global `ValidationPipe({ whitelist: true, transform: true })` in `main.ts` removes unknown fields. Every field the API accepts needs a class-validator decorator in its DTO, otherwise it is silently dropped.
- **Response shape**: service methods return `TaskResponse`, the entity plus a computed `isOverdue` flag (added in `toResponse`). This flag is not stored in the database.
- **Frontend**: `public/` is plain HTML/JS with no build step, served by `useStaticAssets` in `main.ts`. It calls the `/tasks` endpoints with `fetch` (`public/app.js`).
