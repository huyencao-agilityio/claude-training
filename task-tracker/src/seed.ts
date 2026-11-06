import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Task, TASK_PRIORITIES, TASK_STATUSES } from './tasks/task.entity';

const BULK_COUNT = 2500;

const TITLE_WORDS = ['Review', 'Update', 'Prepare', 'Fix', 'Draft', 'Plan', 'Check', 'Write'];
const TITLE_OBJECTS = ['budget', 'slides', 'API docs', 'onboarding', 'release notes', 'invoice list', 'roadmap', 'test plan'];

// A due date is a calendar day, saved as 00:00 UTC of that day whoever picks it (Q-51)
const dueDay = (date: string) => new Date(`${date}T00:00:00Z`);

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length];
}

async function seed() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  const repo = dataSource.getRepository(Task);

  await repo.clear();

  const named: Partial<Task>[] = [
    { title: 'Monthly Report', description: 'Compile KPIs for the monthly review', status: 'todo', priority: 'high', dueDate: dueDay('2026-10-31') },
    { title: 'Weekly Report', description: 'Created by the Vietnam team', status: 'todo', priority: 'medium', dueDate: dueDay('2026-03-20') },
    { title: 'Weekly sync notes', description: 'Created by the UK team', status: 'todo', priority: 'low', dueDate: dueDay('2026-03-20') },
    { title: 'Prepare client meeting', description: null, status: 'in_progress', priority: 'high', dueDate: dueDay('2026-10-16') },
    { title: 'Quarterly report draft', description: null, status: 'done', priority: 'medium', dueDate: dueDay('2026-09-30') },
  ];

  const bulk: Partial<Task>[] = Array.from({ length: BULK_COUNT }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    return {
      title: `${pick(TITLE_WORDS, i)} ${pick(TITLE_OBJECTS, Math.floor(i / 8))} #${i + 1}`,
      description: i % 3 === 0 ? 'Auto-generated sample task' : null,
      status: pick(TASK_STATUSES, i),
      // i / 3, not i: status already cycles every 3 rows, so each status gets every priority
      priority: pick(TASK_PRIORITIES, Math.floor(i / 3)),
      dueDate: i % 5 === 0 ? null : dueDay(`2026-${month}-${day}`),
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
