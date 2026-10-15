import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Task, TASK_STATUSES } from './tasks/task.entity';

const BULK_COUNT = 2500;

const TITLE_WORDS = ['Review', 'Update', 'Prepare', 'Fix', 'Draft', 'Plan', 'Check', 'Write'];
const TITLE_OBJECTS = ['budget', 'slides', 'API docs', 'onboarding', 'release notes', 'invoice list', 'roadmap', 'test plan'];

// Due dates as the web app stores them: midnight in the creator's local time, sent as UTC.
// A user in Vietnam (UTC+7) picking 20 March produces 2026-03-19T17:00:00Z.
const VN_OFFSET_HOURS = 7;
function dueAtLocalMidnight(date: string, utcOffsetHours: number): Date {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(d.getUTCHours() - utcOffsetHours);
  return d;
}

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length];
}

async function seed() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  const repo = dataSource.getRepository(Task);

  await repo.clear();

  const named: Partial<Task>[] = [
    { title: 'Monthly Report', description: 'Compile KPIs for the monthly review', status: 'todo', dueDate: dueAtLocalMidnight('2026-10-31', 0) },
    { title: 'Weekly Report', description: 'Created by the Vietnam team', status: 'todo', dueDate: dueAtLocalMidnight('2026-03-20', VN_OFFSET_HOURS) },
    { title: 'Weekly sync notes', description: 'Created by the UK team', status: 'todo', dueDate: dueAtLocalMidnight('2026-03-20', 0) },
    { title: 'Prepare client meeting', description: null, status: 'in_progress', dueDate: dueAtLocalMidnight('2026-10-16', VN_OFFSET_HOURS) },
    { title: 'Quarterly report draft', description: null, status: 'done', dueDate: dueAtLocalMidnight('2026-09-30', 0) },
  ];

  const bulk: Partial<Task>[] = Array.from({ length: BULK_COUNT }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    return {
      title: `${pick(TITLE_WORDS, i)} ${pick(TITLE_OBJECTS, Math.floor(i / 8))} #${i + 1}`,
      description: i % 3 === 0 ? 'Auto-generated sample task' : null,
      status: pick(TASK_STATUSES, i),
      dueDate: i % 5 === 0 ? null : dueAtLocalMidnight(`2026-${month}-${day}`, i % 2 ? VN_OFFSET_HOURS : 0),
    };
  });

  const all = [...named, ...bulk];
  for (let i = 0; i < all.length; i += 500) {
    await repo.insert(all.slice(i, i + 500));
  }

  console.log(`Seeded ${all.length} tasks`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
