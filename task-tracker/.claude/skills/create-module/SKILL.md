---
name: create-module
description: Scaffold a new NestJS feature module in task-tracker (entity, DTOs, service, controller, module, spec) following the tasks module's patterns, and wire it into AppModule and the shared data source. Use when the user asks to add a new module, resource, entity or CRUD endpoint set.
argument-hint: "<resource name, e.g. projects>"
---

# Create a new feature module

Resource: `$ARGUMENTS` (plural, kebab-case folder, e.g. `projects`, `time-entries`). If no name or fields were given, ask for the resource name and its fields (name, type, required/optional, constraints) before writing code.

Copy the style of `src/tasks/`. Read it first; it is the reference. Don't use `nest g resource`: it generates `@nestjs/mapped-types` imports (not installed) and a different layout.

## Checklist

For a resource `projects` with entity `Project`:

| # | File | What |
|---|------|------|
| 1 | `src/projects/project.entity.ts` | `@Entity('projects')`, uuid PK, `created_at` / `updated_at` `timestamptz`, snake_case column names via `name:`, nullable columns typed `T \| null`. Enums as `export const X = [...] as const` + type, like `TASK_STATUSES`. |
| 2 | `src/projects/dto/create-project.dto.ts` | Every accepted field has class-validator decorators. Optional fields: `@IsOptional()` first. Strings: `@IsString()`, `@IsNotEmpty()`, `@MaxLength()` matching the column. Dates: `@IsDateString()`. Enums: `@IsIn(CONST)`. |
| 3 | `src/projects/dto/update-project.dto.ts` | Same fields, all `@IsOptional()`, written out explicitly (no `PartialType`). |
| 4 | `src/projects/dto/list-projects.query.ts` | Only if the list endpoint takes filters. |
| 5 | `src/projects/projects.service.ts` | `@InjectRepository(Project)`. `findAll`, `findOne`, `create`, `update`, `remove`. Throw `NotFoundException(\`Project ${id} not found\`)` for a missing row (in `update` and `remove` too: check `result.affected`). Map DTO → entity explicitly in `create` (`?? null` for optional fields). In `update`, only overwrite fields the request sent. Parameterized query builder for filters, never string concatenation. |
| 6 | `src/projects/projects.controller.ts` | `@Controller('projects')`. `ParseUUIDPipe` on every `:id`. `@HttpCode(204)` on `DELETE`. No logic: delegate to the service. |
| 7 | `src/projects/projects.module.ts` | `TypeOrmModule.forFeature([Project])`, controller, service. Add `exports: [ProjectsService]` only if another module needs it. |
| 8 | `src/app.module.ts` | Add `ProjectsModule` to `imports`. |
| 9 | `src/data-source.ts` | Add `Project` to `entities`. Without this the table is never created and `seed.ts` can't see it. |
| 10 | `src/projects/projects.service.spec.ts` | Same setup as `tasks.service.spec.ts`: mock repository via `getRepositoryToken(Project)`, no database. Cover at least: `findOne` not found → `NotFoundException`, `create` defaults for optional fields, `update` keeps unsent fields, `remove` not found. |

Optional, only if the user asks:
- **Relation to tasks** (e.g. `Task.projectId`): `@ManyToOne` + `@JoinColumn({ name: 'project_id' })` and an explicit `onDelete`. This changes the `tasks` table on the next start (`synchronize: true`), so call it out.
- **Seed data**: extend `src/seed.ts` with made-up sample data only.
- **Frontend**: `public/` (plain HTML/JS, `fetch`), no build step.

## Verify

```bash
npx tsc --noEmit
npm test
npm run db:up && npm run start:dev   # then smoke-test the endpoints
```

Smoke test, and report the real responses:

```bash
curl -s -X POST localhost:3000/projects -H 'Content-Type: application/json' -d '{"name":"Sample project"}'
curl -s localhost:3000/projects
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/projects/not-a-uuid          # 400
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/projects/00000000-0000-4000-8000-000000000000  # 404
curl -s -X POST localhost:3000/projects -H 'Content-Type: application/json' -d '{}'  # 400 validation error
```

## Report

List the files created/changed, the endpoints (`METHOD /path` → status), test and type-check results, and any schema impact. Suggest a commit like `feat(projects): add projects CRUD endpoints`.
