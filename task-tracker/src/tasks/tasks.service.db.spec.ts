import { DataSource, QueryRunner } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

// Runs against the real PostgreSQL from `npm run db:up` (run with `npm run test:db`).
// Each test runs in a transaction that is rolled back, so the dev data is untouched.
describe('TasksService search (PostgreSQL)', () => {
  const FIXTURE_TITLES = [
    'Monthly Report',
    'Weekly Report',
    'Quarterly report draft',
    'Weekly sync notes',
    '100% done',
    'file_name check',
  ];

  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let service: TasksService;
  let fixtureIds: Map<string, string>;

  // Titles of the fixture tasks returned by the search; seeded rows may match too, so ignore them.
  const searchFixtures = async (search: string) => {
    const ids = new Set(fixtureIds.values());
    const results = await service.findAll({ search });
    return results
      .filter((task) => ids.has(task.id))
      .map((task) => task.title)
      .sort();
  };

  beforeAll(async () => {
    dataSource = await new DataSource({ ...dataSourceOptions(), synchronize: false }).initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    const repository = queryRunner.manager.getRepository(Task);
    service = new TasksService(repository);

    const saved = await repository.save(FIXTURE_TITLES.map((title) => repository.create({ title })));
    fixtureIds = new Map(saved.map((task) => [task.title, task.id]));
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  it('finds "Monthly Report" and "Weekly Report" when searching "report" (ticket 1)', async () => {
    await expect(searchFixtures('report')).resolves.toEqual([
      'Monthly Report',
      'Quarterly report draft',
      'Weekly Report',
    ]);
  });

  it.each(['REPORT', 'Report', 'rep', '  report  '])(
    'returns the same report tasks for %j',
    async (search) => {
      await expect(searchFixtures(search)).resolves.toEqual([
        'Monthly Report',
        'Quarterly report draft',
        'Weekly Report',
      ]);
    },
  );

  it('matches a word anywhere in the title', async () => {
    await expect(searchFixtures('monthly')).resolves.toEqual(['Monthly Report']);
    await expect(searchFixtures('weekly')).resolves.toEqual(['Weekly Report', 'Weekly sync notes']);
  });

  it('treats % and _ as literal characters', async () => {
    await expect(searchFixtures('%')).resolves.toEqual(['100% done']);
    await expect(searchFixtures('_')).resolves.toEqual(['file_name check']);
  });
});
