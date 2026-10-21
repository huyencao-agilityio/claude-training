---
name: how-we-structure-modules
description: How task-tracker NestJS feature modules are structured - folder and file names, what goes in the controller vs the service, DTO validation rules, entity rules, and where each kind of test lives. Use when writing, moving or reviewing code under src/ (a new endpoint, service method, DTO, entity, module or spec), or when asked where something belongs or why the code is laid out this way.
---

# How we structure modules

`src/tasks/` is the reference module. When a rule here and the code disagree, say so instead of guessing which one is right. To scaffold a whole new CRUD module, use the `create-module` skill; it follows these rules.

## Layout and names

One folder per resource under `src/`, named with the **plural, kebab-case** resource. Files inside use the same name, except the entity and the DTOs, which use the singular.

```text
src/time-entries/
├── time-entries.module.ts          TimeEntriesModule
├── time-entries.controller.ts      TimeEntriesController
├── time-entries.service.ts         TimeEntriesService, TimeEntryResponse type
├── time-entries.service.spec.ts    unit tests, mocked repository
├── time-entries.service.db.spec.ts optional, real PostgreSQL
├── time-entry.entity.ts            TimeEntry, enum constants
└── dto/
    ├── create-time-entry.dto.ts    CreateTimeEntryDto
    ├── update-time-entry.dto.ts    UpdateTimeEntryDto
    ├── list-time-entries.query.ts  ListTimeEntriesQuery (GET list filters)
    └── *.spec.ts                   validation tests
```

- Global setup stays in `src/main.ts` (`ValidationPipe`, static files) and `src/data-source.ts` (DB options, `entities` list). There is no `common/` or `shared/` folder yet; don't create one for a single helper. Keep a helper used by one service as a `const` in that service file, like `escapeLike` in `tasks.service.ts`.
- Every new module is imported in `src/app.module.ts`, and every new entity is added to `entities` in `src/data-source.ts`. Without the second step the table is never created and `seed.ts` can't see it.

## Controller: receive the request, call the service

```ts
@Patch(':id')
update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
  return this.tasksService.update(id, dto);
}
```

- `@Controller('<plural>')`. Each handler is one line: it passes params, body and query to one service method and returns what the service returns.
- `ParseUUIDPipe` on every `:id`, so a bad id is a 400 before the service runs.
- `@Body()` takes a DTO class and `@Query()` takes a query class, never a plain object or `any`.
- `@HttpCode(204)` on `DELETE`.
- No business logic, no `if`, no repository, no `try/catch`, no response mapping. If a handler needs more than one call, the logic belongs in a service method.

## Service: all logic and data access

- Inject the repository as `@InjectRepository(Task) private readonly tasks: Repository<Task>`.
- Throw Nest HTTP exceptions here, with the id in the message: `throw new NotFoundException(\`Task ${id} not found\`)`. `update` and `remove` check for a missing row too (`remove` checks `result.affected`).
- `create` maps the DTO to the entity field by field, with `?? null` for optional fields and defaults set in code (`status: dto.status ?? 'todo'`).
- `update` (PATCH) only changes fields the request sent: test `!== undefined`, not truthiness, so `null` and `""` still reach validation.
- Every public method returns the response type (`TaskResponse`) through a private `toResponse()`. Computed fields such as `isOverdue` are added there and never stored.
- Filters use the query builder with named parameters (`:search`), never string concatenation. If a filter repeats a rule from `toResponse` in SQL (like `overdue`), say so in a comment so the two stay in sync.
- One module does not use another module's repository. It imports that module and calls its service, which the other module lists in `exports`.

## DTOs: every field is validated

The global `ValidationPipe({ whitelist: true, transform: true })` **silently drops any field without a class-validator decorator**, so a missing decorator looks like "the API ignores my field", not an error.

- Optional fields: `@IsOptional()` first.
- User text: `@Transform` to trim before validation, then `@IsString()`, `@IsNotEmpty()`, `@MaxLength()` matching the column.
- Enums: an `as const` array exported from the entity file (`TASK_STATUSES`) and `@IsIn(TASK_STATUSES)`.
- Dates: `@IsDateString()`; the DTO keeps the ISO string and the service converts it to `Date`.
- Query booleans: transform only `'true'` / `'false'` and leave anything else for `@IsBoolean()` to reject (`Boolean('false')` is `true`).
- The update DTO is written out with every field `@IsOptional()`. Don't use `PartialType`: `@nestjs/mapped-types` is not installed.

## Entity

- `@Entity('<plural>')`, `@PrimaryGeneratedColumn('uuid')`, `createdAt` / `updatedAt` as `timestamptz`.
- Column names in snake_case through `name:` (`dueDate` → `due_date`); properties in camelCase.
- Nullable columns are typed `T | null` and stored as `null`, never `undefined` or `""`.
- Dates are `timestamptz`. `synchronize: true` changes the table on the next start, so call out any renamed, dropped or retyped column.

## Tests: next to the code

| What | File | How |
|---|---|---|
| Service logic | `<plural>.service.spec.ts` | `Test.createTestingModule` with `{ provide: getRepositoryToken(Entity), useValue: mock }`; query builder methods mocked with `mockReturnThis()`. No database. Runs in `npm test`. |
| DTO validation | `dto/<name>.spec.ts` | Build `new ValidationPipe({ whitelist: true, transform: true })` (same options as `main.ts`) and call `pipe.transform(body, { type: 'body' \| 'query', metatype })`. |
| Real SQL (search, filters, constraints) | `<plural>.service.db.spec.ts` | Real PostgreSQL from `npm run db:up`; each test in a transaction that is rolled back; only assert on the fixture rows it created, because the seed data is there too. Skipped by `npm test`; run with `npm run test:db`. |
| Controller | none | Controllers have no logic. If one seems to need a test, move the logic into the service. |

A bug fix comes with a test that fails without the fix. A feature comes with tests for its edge cases and validation errors.
