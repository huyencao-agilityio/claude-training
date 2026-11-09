import { DataSource, QueryRunner } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { MAX_PAGE_LIMIT } from './dto/list-tasks.query';
import { Task } from './task.entity';
import { TaskPage, TasksService } from './tasks.service';

// Runs against the real PostgreSQL from `npm run db:up` (run with `npm run test:db`).
// Each test runs in a transaction that is rolled back, so the dev data is untouched.
describe('TasksService.findAll (PostgreSQL)', () => {
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
  // Who is asking; only "Assigned to me" reads it
  const me = { id: '00000000-0000-4000-8000-0000000000a1', role: 'user' } as const;

  // Titles of the fixture tasks returned by the search; seeded rows may match too, so ignore them.
  const searchFixtures = async (search: string) => {
    const ids = new Set(fixtureIds.values());
    const { items } = await service.findAll({ search, limit: MAX_PAGE_LIMIT }, me);
    return items
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
    service = new TasksService(repository, new UsersService(queryRunner.manager.getRepository(User)));

    // High and newest, so they come first on the page even when seeded tasks match the search too
    // (the list is ordered by priority, then newest first)
    const saved = await repository.save(
      FIXTURE_TITLES.map((title) => repository.create({ title, priority: 'high' })),
    );
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

  it('pages through tasks with the same createdAt without repeating or skipping any', async () => {
    // Rows inserted in one transaction share createdAt (now() is the transaction start time)
    const repository = queryRunner.manager.getRepository(Task);
    const tied = await repository.save(
      Array.from({ length: 7 }, (_, i) => repository.create({ title: `Pagination tie ${i + 1}` })),
    );

    // One query at a time: the transaction's single connection can't run them in parallel
    const pages: TaskPage[] = [];
    for (const page of [1, 2, 3, 4]) {
      pages.push(await service.findAll({ search: 'Pagination tie', page, limit: 3 }, me));
    }

    expect(pages.map((p) => p.items.length)).toEqual([3, 3, 1, 0]);
    expect(pages.every((p) => p.total === 7)).toBe(true);
    const pagedIds = pages.flatMap((p) => p.items.map((task) => task.id));
    expect(new Set(pagedIds).size).toBe(7);
    expect([...pagedIds].sort()).toEqual(tied.map((task) => task.id).sort());
  });

  describe('T2: priority order, tabs and due days', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const todayStart = () => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    };

    // Saves the tasks, then sets their created_at, which save() leaves to the database
    const saveTasks = async (tasks: (Partial<Task> & { createdAt?: Date })[]) => {
      const repository = queryRunner.manager.getRepository(Task);
      const saved = await repository.save(tasks.map(({ createdAt: _c, ...task }) => repository.create(task)));
      for (const [i, task] of tasks.entries()) {
        if (task.createdAt) {
          await queryRunner.query('UPDATE tasks SET created_at = $1 WHERE id = $2', [task.createdAt, saved[i].id]);
        }
      }
      return saved;
    };

    const titles = (page: TaskPage) => page.items.map((task) => task.title);

    it('lists High, then Medium, then Low, newest first inside one priority (AC2.4, AC2.5)', async () => {
      const now = Date.now();
      await saveTasks([
        { title: 'Prio low old', priority: 'low', createdAt: new Date(now - 4 * 60_000) },
        { title: 'Prio high old', priority: 'high', createdAt: new Date(now - 3 * 60_000) },
        { title: 'Prio medium', priority: 'medium', createdAt: new Date(now - 2 * 60_000) },
        { title: 'Prio low new', priority: 'low', createdAt: new Date(now - 60_000) },
        { title: 'Prio high new', priority: 'high', createdAt: new Date(now) },
      ]);
      const expected = ['Prio high new', 'Prio high old', 'Prio medium', 'Prio low new', 'Prio low old'];

      expect(titles(await service.findAll({ search: 'Prio ', limit: MAX_PAGE_LIMIT }, me))).toEqual(expected);

      // Page by page, one task each: the same order, with nothing repeated or skipped
      const paged: string[] = [];
      for (let page = 1; page <= 6; page++) {
        paged.push(...titles(await service.findAll({ search: 'Prio ', page, limit: 1 }, me)));
      }
      expect(paged).toEqual(expected);
    });

    it('gives a task saved before T2 priority medium (AC2.11)', async () => {
      const [task] = await saveTasks([{ title: 'Prio from before' }]);
      // Same as a row the new column was added to: the default fills it
      await queryRunner.query('UPDATE tasks SET priority = DEFAULT WHERE id = $1', [task.id]);

      await expect(service.findOne(task.id)).resolves.toMatchObject({ priority: 'medium' });
    });

    it('puts each task on its tab, a task due today on Active (AC2.8 to AC2.10)', async () => {
      const today = todayStart();
      await saveTasks([
        { title: 'Tab due tomorrow', status: 'todo', dueDate: new Date(today.getTime() + DAY) },
        { title: 'Tab due today', status: 'todo', dueDate: today },
        { title: 'Tab no due date', status: 'in_progress', dueDate: null },
        { title: 'Tab due yesterday', status: 'todo', dueDate: new Date(today.getTime() - DAY) },
        { title: 'Tab done', status: 'done', dueDate: new Date(today.getTime() - DAY) },
      ]);
      const onTab = async (tab: 'active' | 'overdue' | 'done') =>
        titles(await service.findAll({ search: 'Tab ', tab, limit: MAX_PAGE_LIMIT }, me)).sort();

      await expect(onTab('active')).resolves.toEqual(['Tab due today', 'Tab due tomorrow', 'Tab no due date']);
      await expect(onTab('overdue')).resolves.toEqual(['Tab due yesterday']);
      await expect(onTab('done')).resolves.toEqual(['Tab done']);
    });

    it('rounds due dates saved as local midnight to the nearest 00:00 UTC, once (Q-51)', async () => {
      const saved = await saveTasks([
        { title: 'Due VN 20 March', dueDate: new Date('2026-03-19T17:00:00.000Z') }, // UTC+7
        { title: 'Due US 20 March', dueDate: new Date('2026-03-20T05:00:00.000Z') }, // UTC-5
        { title: 'Due UTC 20 March', dueDate: new Date('2026-03-20T00:00:00.000Z') },
        { title: 'Due none', dueDate: null },
      ]);

      const updatedBefore = await queryRunner.query('SELECT updated_at FROM tasks WHERE id = $1', [saved[0].id]);

      expect(await service.roundDueDatesToUtcDay()).toBeGreaterThanOrEqual(2);
      // A data fix, not an edit: updated_at stays as it was
      await expect(
        queryRunner.query('SELECT updated_at FROM tasks WHERE id = $1', [saved[0].id]),
      ).resolves.toEqual(updatedBefore);

      const dueDates = await Promise.all(saved.map(async (task) => (await service.findOne(task.id)).dueDate));
      expect(dueDates).toEqual([
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-20T00:00:00.000Z'),
        null,
      ]);
      // Every due date is now 00:00 UTC, so a second run changes nothing
      await expect(service.roundDueDatesToUtcDay()).resolves.toBe(0);
    });
  });

  describe('T3: assignee', () => {
    let ann: User;
    let ben: User;

    // Assigned tasks need real user rows (foreign key); they are rolled back with the rest
    beforeEach(async () => {
      const users = queryRunner.manager.getRepository(User);
      const user = (name: string) =>
        users.create({ email: `${name.toLowerCase()}.t3-spec@example.com`, name, role: 'user', passwordHash: 'x' });
      [ann, ben] = await users.save([user('Ann'), user('Ben')]);
      const tasks = queryRunner.manager.getRepository(Task);
      await tasks.save([
        tasks.create({ title: 'Asg Ann high', priority: 'high', assigneeId: ann.id }),
        tasks.create({ title: 'Asg Ann low', priority: 'low', assigneeId: ann.id }),
        tasks.create({ title: 'Asg Ben', priority: 'high', assigneeId: ben.id }),
        tasks.create({ title: 'Asg none', priority: 'high' }),
      ]);
    });

    const list = async (filters: object, user: { id: string; role: 'admin' | 'user' } = me) =>
      (await service.findAll({ search: 'Asg ', limit: MAX_PAGE_LIMIT, ...filters }, user)).items;

    it('shows the assignee as id and name only, and null for an unassigned task (AC3.7, AC3.9)', async () => {
      const items = await list({});
      const byTitle = new Map(items.map((task) => [task.title, task.assignee]));

      expect(byTitle.get('Asg Ann high')).toEqual({ id: ann.id, name: 'Ann' });
      expect(byTitle.get('Asg none')).toBeNull();
      expect(items.every((task) => !('assigneeId' in task))).toBe(true);
    });

    it('keeps only my tasks for "Assigned to me", together with the priority filter (AC3.8)', async () => {
      const asAnn = { id: ann.id, role: 'user' } as const;

      expect((await list({ assignee: 'me' }, asAnn)).map((t) => t.title)).toEqual(['Asg Ann high', 'Asg Ann low']);
      expect((await list({ assignee: 'me', priority: 'high' }, asAnn)).map((t) => t.title)).toEqual(['Asg Ann high']);
    });

    it('keeps only the unassigned tasks for "Unassigned" (AC3.16)', async () => {
      expect((await list({ assignee: 'unassigned' })).map((t) => t.title)).toEqual(['Asg none']);
    });

    it("still shows the name of an assignee removed from the users file (AC3.15)", async () => {
      await queryRunner.query('UPDATE users SET removed_at = now() WHERE id = $1', [ben.id]);

      const benTask = (await list({})).find((task) => task.title === 'Asg Ben');

      expect(benTask?.assignee).toEqual({ id: ben.id, name: 'Ben' });
    });

    it('saves and returns the assignee through create and update (AC3.1, AC3.3)', async () => {
      const created = await service.create({ title: 'Asg created', assigneeId: ann.id });
      expect(created.assignee).toEqual({ id: ann.id, name: 'Ann' });

      const updated = await service.update(created.id, { assigneeId: ben.id }, me);
      expect(updated.assignee).toEqual({ id: ben.id, name: 'Ben' });
      await expect(service.findOne(created.id)).resolves.toMatchObject({ assignee: { id: ben.id, name: 'Ben' } });

      await service.update(created.id, { assigneeId: null }, me);
      await expect(service.findOne(created.id)).resolves.toMatchObject({ assignee: null });
    });

    it('streams the raw columns the CSV export reads (AC3.14)', async () => {
      // The export streams on its own connection, which can't see this transaction's rows, so the
      // same query is streamed here on the transaction's connection
      const rows: Record<string, unknown>[] = [];
      for await (const row of await service['filteredQuery']({ search: 'Asg Ann high' }, me).stream()) {
        rows.push(row as Record<string, unknown>);
      }

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ task_assignee_id: ann.id, assignee_id: ann.id, assignee_name: 'Ann' });
      expect(service['fromRaw'](rows[0] as never).assignee).toMatchObject({ id: ann.id, name: 'Ann' });
    });
  });
});
