# Task Tracker (Day 2 practice)

A small NestJS + PostgreSQL task tracker that goes with the tickets in [`dojo-ai-training/day-2/tickets`](../dojo-ai-training/day-2/tickets).

## Requirements

- Node.js 22+
- Docker (for PostgreSQL)

## Run it

```bash
npm install
cp .env.example .env   # optional, defaults match docker-compose
npm run db:up          # PostgreSQL 17 on localhost:5433
npm run seed           # ~2,500 sample tasks (wipes the tasks table)
npm run start:dev      # http://localhost:3000
```

Open http://localhost:3000 for the web UI. Stop the database with `npm run db:down`.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/tasks?search=&status=` | List tasks, newest first. `status`: `todo`, `in_progress`, `done` |
| GET | `/tasks/:id` | One task |
| POST | `/tasks` | `{ title, description?, status?, dueDate? }`, `dueDate` is an ISO 8601 string |
| PATCH | `/tasks/:id` | Any of the fields above |
| DELETE | `/tasks/:id` | |

Each task in a response includes a computed `isOverdue` flag.

## Layout

```
src/
  main.ts              bootstrap, validation pipe, serves public/
  app.module.ts        config + TypeORM
  data-source.ts       DB connection options (shared with the seed script)
  seed.ts              sample data
  tasks/               entity, DTOs, service, controller
public/                web UI (plain HTML/JS)
```

The schema is created automatically from the entity (`synchronize: true`, dev only).
