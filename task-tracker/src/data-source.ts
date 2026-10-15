import { DataSourceOptions } from 'typeorm';
import { Task } from './tasks/task.entity';

export function dataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5433),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'task_tracker',
    entities: [Task],
    // Dev-only: keeps the schema in sync with the entities without migrations.
    synchronize: true,
  };
}
