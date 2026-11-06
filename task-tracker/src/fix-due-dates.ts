import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Task } from './tasks/task.entity';
import { TasksService } from './tasks/tasks.service';

// Run once after deploying T2: before it, the web app saved a due date as the creator's local
// midnight. Rounds each one to the nearest 00:00 UTC; a second run changes nothing (AC2.16, Q-51).
async function fixDueDates() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  try {
    const rounded = await new TasksService(dataSource.getRepository(Task)).roundDueDatesToUtcDay();
    console.log(`Rounded ${rounded} due date(s)`);
  } finally {
    await dataSource.destroy();
  }
}

fixDueDates().catch((err) => {
  console.error(err);
  process.exit(1);
});
