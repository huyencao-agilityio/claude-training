import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';
import { Task } from './tasks/task.entity';
import { TasksService } from './tasks/tasks.service';
import { User } from './users/user.entity';
import { UsersService } from './users/users.service';

// Run once after deploying T2: before it, the web app saved a due date as the creator's local
// midnight. Rounds each one to the nearest 00:00 UTC; a second run changes nothing (AC2.16, Q-51).
async function fixDueDates() {
  const dataSource = new DataSource(dataSourceOptions());
  await dataSource.initialize();
  try {
    const users = new UsersService(dataSource.getRepository(User));
    const rounded = await new TasksService(dataSource.getRepository(Task), users).roundDueDatesToUtcDay();
    console.log(`Rounded ${rounded} due date(s)`);
  } finally {
    await dataSource.destroy();
  }
}

fixDueDates().catch((err) => {
  console.error(err);
  process.exit(1);
});
