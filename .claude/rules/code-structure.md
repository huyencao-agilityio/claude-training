---
paths:
  - "task-tracker/src/**"
---

# Code structure (task-tracker)

`src/tasks/` is the reference module. If this file and the code disagree, say so instead of guessing.

## Layout

- One folder per resource under `src/`, plural kebab-case (`src/time-entries/`). Entity and DTO files use the singular (`time-entry.entity.ts`, `dto/create-time-entry.dto.ts`).
- Every new module goes in `imports` of `src/app.module.ts`; every new entity goes in `entities` of `src/data-source.ts`, or the table is never created and `seed.ts` can't see it.
- No `common/` or `shared/` folder for a single helper: keep it as a `const` in the service file.

## Controller: one line per handler

- `@Controller('<plural>')`; each handler passes params, body and query to one service method and returns its result.
- `ParseUUIDPipe` on every `:id`; `@Body()` / `@Query()` take a DTO class; `@HttpCode(204)` on `DELETE`.
- No logic, no `if`, no repository, no `try/catch`.

## Service: all logic and data access

- `@InjectRepository(Entity) private readonly repo: Repository<Entity>`. One module never uses another module's repository: import that module and call its exported service.
- Missing rows throw `NotFoundException` with the id; `update` and `remove` check too (`result.affected`).
- `create` maps the DTO field by field (`?? null` for optional fields). `update` changes only fields sent (`!== undefined`, not truthiness).
- Return the response type through a private `toResponse()`; computed fields (`isOverdue`) are added there, never stored. Lists return `{ items, total, page, limit }`.
- Filters use the query builder with named parameters (`:search`), never string concatenation.

## DTOs: every field decorated

- The global `ValidationPipe({ whitelist: true, transform: true })` silently drops a field without a class-validator decorator.
- Optional: `@IsOptional()` first. Text: trim with `@Transform`, then `@IsString()`, `@IsNotEmpty()`, `@MaxLength()` matching the column. Enums: `as const` array in the entity file + `@IsIn()`. Dates: `@IsDateString()`.
- Update DTOs are written out with every field `@IsOptional()` (no `PartialType`: `@nestjs/mapped-types` is not installed).

## Entity

- uuid primary key, `createdAt` / `updatedAt` as `timestamptz`, snake_case columns via `name:`, nullable columns typed `T | null`.
- `synchronize: true` changes the table on the next start: call out any renamed, dropped or retyped column.

## Tests: next to the code

| What | File | How |
|---|---|---|
| Service logic | `<plural>.service.spec.ts` | Mocked repository (`getRepositoryToken`), no DB. Runs in `npm test`. |
| DTO validation | `dto/<name>.spec.ts` | `ValidationPipe` with the same options as `main.ts`. |
| Real SQL | `<plural>.service.db.spec.ts` | Real PostgreSQL, each test in a rolled-back transaction. `npm run test:db`. |
| Controller | none | No logic to test; move logic to the service. |
