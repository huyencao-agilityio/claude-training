import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  // Logged-in users and possible assignees; full rows, as the relation loads them
  const userRow = (id: string, name: string, role: 'admin' | 'user' = 'user') =>
    ({ id, name, role, email: `${name.toLowerCase()}@example.com`, passwordHash: 'hash', removedAt: null }) as User;
  const ADMIN = userRow('00000000-0000-4000-8000-0000000000ad', 'Admin', 'admin');
  const ALICE = userRow('00000000-0000-4000-8000-0000000000a1', 'Alice');
  const BOB = userRow('00000000-0000-4000-8000-0000000000b0', 'Bob');
  const me = { id: ALICE.id, role: 'user' } as const;

  const queryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    setQueryRunner: jest.fn().mockReturnThis(),
    stream: jest.fn(),
  };
  const queryRunner = { release: jest.fn() };
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((task: Partial<Task>) => task),
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: { transaction: jest.fn(), connection: { createQueryRunner: () => queryRunner } },
  };
  // Active users only, like the real findActiveById
  const usersService = { findActiveById: jest.fn() };

  beforeEach(async () => {
    repository.findOne.mockReset();
    repository.manager.transaction.mockReset();
    usersService.findActiveById
      .mockReset()
      .mockImplementation(async (id: string) => [ADMIN, ALICE, BOB].find((u) => u.id === id) ?? null);
    Object.values(queryBuilder).forEach((fn) => fn.mockClear());
    queryBuilder.getManyAndCount.mockReset().mockResolvedValue([[], 0]);
    queryBuilder.stream.mockReset().mockImplementation(async () => Readable.from([]));
    queryRunner.release.mockClear();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  describe('findAll tabs and priority', () => {
    // 10:00 UTC on 21 March: "today" starts at 00:00 UTC on 21 March (Q-34)
    const NOW = new Date('2026-03-21T10:00:00.000Z');
    const TODAY_START = new Date('2026-03-21T00:00:00.000Z');
    const ACTIVE_SQL = "task.status != 'done' AND (task.dueDate IS NULL OR task.dueDate >= :todayStart)";
    const OVERDUE_SQL = "task.status != 'done' AND task.dueDate < :todayStart";

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(NOW);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('adds no condition when no tab or filter is sent', async () => {
      await service.findAll({}, me);

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('keeps not-done tasks with no due date or a due date from today on, on the Active tab (AC2.8)', async () => {
      await service.findAll({ tab: 'active' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([[ACTIVE_SQL, { todayStart: TODAY_START }]]);
    });

    it('keeps not-done tasks due before today on the Overdue tab (AC2.9)', async () => {
      await service.findAll({ tab: 'overdue' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([[OVERDUE_SQL, { todayStart: TODAY_START }]]);
    });

    it('starts "today" at 00:00 UTC whatever the hour (TC-64)', async () => {
      jest.setSystemTime(new Date('2026-03-21T23:59:59.999Z'));
      await service.findAll({ tab: 'overdue' }, me);
      jest.setSystemTime(new Date('2026-03-22T00:00:00.000Z'));
      await service.findAll({ tab: 'overdue' }, me);

      expect(queryBuilder.andWhere.mock.calls.map(([, params]) => params)).toEqual([
        { todayStart: new Date('2026-03-21T00:00:00.000Z') },
        { todayStart: new Date('2026-03-22T00:00:00.000Z') },
      ]);
    });

    it('keeps only done tasks on the Done tab, whatever their due date (AC2.10)', async () => {
      await service.findAll({ tab: 'done' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([["task.status = 'done'"]]);
    });

    it('does not apply the status filter on the Done tab (AC2.10, AC2.14)', async () => {
      await service.findAll({ tab: 'done', status: 'in_progress' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([["task.status = 'done'"]]);
    });

    it('applies the status filter on the other tabs', async () => {
      await service.findAll({ tab: 'active', status: 'in_progress' }, me);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', { status: 'in_progress' });
    });

    it('keeps only the picked priority inside the tab (AC2.7)', async () => {
      await service.findAll({ tab: 'overdue', priority: 'high' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([
        ['task.priority = :priority', { priority: 'high' }],
        [OVERDUE_SQL, { todayStart: TODAY_START }],
      ]);
    });

    it('combines tab, priority, search and status (AC2.13)', async () => {
      await service.findAll({ tab: 'active', priority: 'high', search: 'report', status: 'todo' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([
        ["task.title ILIKE :search ESCAPE '\\'", { search: '%report%' }],
        ['task.status = :status', { status: 'todo' }],
        ['task.priority = :priority', { priority: 'high' }],
        [ACTIVE_SQL, { todayStart: TODAY_START }],
      ]);
    });
  });

  describe('findAll assignee', () => {
    it('joins only the id and name of the assignee, removed users included (AC3.7, AC3.15)', async () => {
      await service.findAll({}, me);

      expect(queryBuilder.leftJoin).toHaveBeenCalledWith('task.assignee', 'assignee');
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(['assignee.id', 'assignee.name']);
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('keeps the tasks of the logged-in user for "Assigned to me" (AC3.8)', async () => {
      await service.findAll({ assignee: 'me' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([['task.assigneeId = :userId', { userId: ALICE.id }]]);
    });

    it('keeps the unassigned tasks for "Unassigned" (AC3.16)', async () => {
      await service.findAll({ assignee: 'unassigned' }, me);

      expect(queryBuilder.andWhere.mock.calls).toEqual([['task.assigneeId IS NULL']]);
    });

    it.each(['me', 'unassigned'] as const)(
      'combines %s with the tab, priority and search (AC3.8, AC3.16)',
      async (assignee) => {
        await service.findAll({ tab: 'done', priority: 'high', search: 'report', assignee }, me);

        expect(queryBuilder.andWhere.mock.calls.map(([sql]) => sql)).toEqual([
          "task.title ILIKE :search ESCAPE '\\'",
          'task.priority = :priority',
          assignee === 'me' ? 'task.assigneeId = :userId' : 'task.assigneeId IS NULL',
          "task.status = 'done'",
        ]);
      },
    );

    it('returns only the id and name of each assignee (AC3.7)', async () => {
      const task = { id: '00000000-0000-4000-8000-000000000001', title: 'T', status: 'todo', dueDate: null };
      queryBuilder.getManyAndCount.mockResolvedValue([[{ ...task, assigneeId: BOB.id, assignee: BOB }], 1]);

      const { items } = await service.findAll({}, me);

      expect(items).toEqual([{ ...task, assignee: { id: BOB.id, name: 'Bob' }, isOverdue: false }]);
    });
  });

  describe('isOverdue', () => {
    const due20March = {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Weekly Report',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: new Date('2026-03-20T00:00:00.000Z'),
    } as Task;

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['during the due day', '2026-03-20T00:00:00.000Z', false],
      ['at the last moment of the due day', '2026-03-20T23:59:59.999Z', false],
      ['from 00:00 UTC the next day (AC2.9, AC2.16)', '2026-03-21T00:00:00.000Z', true],
    ])('is %s: %s -> %s', async (_when, now, overdue) => {
      jest.useFakeTimers().setSystemTime(new Date(now));
      repository.findOne.mockResolvedValue(due20March);

      await expect(service.findOne(due20March.id)).resolves.toMatchObject({ isOverdue: overdue });
    });

    it('is never true for a done task', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
      repository.findOne.mockResolvedValue({ ...due20March, status: 'done' });

      await expect(service.findOne(due20March.id)).resolves.toMatchObject({ isOverdue: false });
    });
  });

  describe('findAll pagination', () => {
    it('returns the first page of 20 tasks by default', async () => {
      await expect(service.findAll({}, me)).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });

      expect(queryBuilder.offset).toHaveBeenCalledWith(0);
      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    });

    it('skips the tasks of the previous pages', async () => {
      await service.findAll({ page: 3, limit: 50 }, me);

      expect(queryBuilder.offset).toHaveBeenCalledWith(100);
      expect(queryBuilder.limit).toHaveBeenCalledWith(50);
    });

    it('orders High, Medium, Low, then newest first, ties broken by id (AC2.4, AC2.5)', async () => {
      await service.findAll({}, me);

      expect(queryBuilder.addSelect.mock.calls).toEqual([
        [['assignee.id', 'assignee.name']],
        ["CASE task.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END", 'priority_rank'],
      ]);
      expect(queryBuilder.orderBy.mock.calls).toEqual([['priority_rank', 'ASC']]);
      expect(queryBuilder.addOrderBy.mock.calls).toEqual([
        ['task.createdAt', 'DESC'],
        ['task.id', 'DESC'],
      ]);
      // orderBy replaces any earlier ordering, so createdAt and id must be added after it
      expect(queryBuilder.addOrderBy.mock.invocationCallOrder[0]).toBeGreaterThan(
        queryBuilder.orderBy.mock.invocationCallOrder[0],
      );
    });

    // A transaction per list request costs extra round trips and holds a pooled connection
    it('reads the page and the total without opening a transaction', async () => {
      await service.findAll({}, me);

      expect(repository.manager.transaction).not.toHaveBeenCalled();
      expect(queryBuilder.getManyAndCount).toHaveBeenCalledTimes(1);
    });

    it('returns the page items with isOverdue and the total of all matching tasks', async () => {
      const task = {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Write report',
        description: null,
        status: 'todo',
        dueDate: new Date('2000-01-01T00:00:00Z'),
      } as Task;
      queryBuilder.getManyAndCount.mockResolvedValue([[task], 41]);

      await expect(service.findAll({ status: 'todo', page: 3 }, me)).resolves.toEqual({
        items: [{ ...task, assignee: null, isOverdue: true }],
        total: 41,
        page: 3,
        limit: 20,
      });
    });

    // A join with skip/take pages through a DISTINCT id subquery that loses the priority_rank order
    it('pages with offset and limit, not skip and take', async () => {
      await service.findAll({ page: 2 }, me);

      expect(queryBuilder.offset).toHaveBeenCalledWith(20);
      expect(queryBuilder.limit).toHaveBeenCalledWith(20);
      expect(queryBuilder).not.toHaveProperty('skip');
      expect(queryBuilder).not.toHaveProperty('take');
    });

    it('returns no items but the real total for a page past the end', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 41]);

      await expect(service.findAll({ page: 99 }, me)).resolves.toEqual({
        items: [],
        total: 41,
        page: 99,
        limit: 20,
      });
    });
  });

  describe('exportCsv', () => {
    const HEADER = 'id,title,description,status,dueDate,isOverdue,createdAt,assignee,priority';
    // Raw rows as qb.stream() yields them: <alias>_<column name>, not entities
    const raw = {
      task_description: null,
      task_status: 'todo',
      task_priority: 'high',
      // From addSelect: not a task column, so it is not written to the file
      priority_rank: 0,
      task_created_at: new Date('2026-01-15T08:00:00.000Z'),
      task_updated_at: new Date('2026-01-15T08:00:00.000Z'),
      task_assignee_id: null,
      // From the left join: null when the task is unassigned
      assignee_id: null,
      assignee_name: null,
    };

    const read = async (stream: Readable) => {
      let csv = '';
      for await (const chunk of stream) csv += chunk;
      return csv;
    };

    afterEach(() => {
      jest.useRealTimers();
    });

    it('applies the same tab, priority, search and status filters as findAll (AC2.12)', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-03-21T10:00:00Z'));
      const filters = { search: ' 50% ', status: 'todo', tab: 'overdue', priority: 'high', assignee: 'me' } as const;
      await service.findAll(filters, me);
      const listCalls = queryBuilder.andWhere.mock.calls;
      queryBuilder.andWhere.mockClear();

      await read(service.exportCsv(filters, me));

      expect(queryBuilder.andWhere.mock.calls).toEqual(listCalls);
      expect(listCalls).toHaveLength(5);
    });

    it('does not apply the status filter on the Done tab', async () => {
      await read(service.exportCsv({ tab: 'done', status: 'todo' }, me));

      expect(queryBuilder.andWhere.mock.calls).toEqual([["task.status = 'done'"]]);
    });

    it('streams every matching task without paging', async () => {
      await read(service.exportCsv({}, me));

      expect(queryBuilder.offset).not.toHaveBeenCalled();
      expect(queryBuilder.limit).not.toHaveBeenCalled();
      expect(queryBuilder.stream).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
    });

    it('keeps the list order: High to Low, then newest first, ties broken by id (AC2.12)', async () => {
      await read(service.exportCsv({}, me));

      // orderBy replaces the whole ORDER BY, so a second call would silently drop this order
      expect(queryBuilder.orderBy.mock.calls).toEqual([['priority_rank', 'ASC']]);
      expect(queryBuilder.addOrderBy.mock.calls).toEqual([
        ['task.createdAt', 'DESC'],
        ['task.id', 'DESC'],
      ]);
    });

    it('returns only the header row when no task matches', async () => {
      await expect(read(service.exportCsv({ search: 'nothing matches' }, me))).resolves.toBe(
        `\uFEFF${HEADER}\r\n`,
      );
    });

    it('writes a row per task with the computed isOverdue', async () => {
      queryBuilder.stream.mockResolvedValue(
        Readable.from([
          { ...raw, task_id: 'a', task_title: 'Late', task_due_date: new Date('2000-01-01') },
          { ...raw, task_id: 'b', task_title: 'Undated', task_due_date: null },
        ]),
      );

      await expect(read(service.exportCsv({}, me))).resolves.toBe(
        `\uFEFF${HEADER}\r\n` +
          'a,Late,,todo,2000-01-01T00:00:00.000Z,true,2026-01-15T08:00:00.000Z,Unassigned,high\r\n' +
          'b,Undated,,todo,,false,2026-01-15T08:00:00.000Z,Unassigned,high\r\n',
      );
    });

    it('writes the assignee name from the joined row (AC3.14)', async () => {
      queryBuilder.stream.mockResolvedValue(
        Readable.from([
          {
            ...raw,
            task_id: 'a',
            task_title: 'Mine',
            task_due_date: null,
            task_assignee_id: ALICE.id,
            assignee_id: ALICE.id,
            assignee_name: 'Alice',
          },
        ]),
      );

      await expect(read(service.exportCsv({}, me))).resolves.toBe(
        `\uFEFF${HEADER}\r\n` + 'a,Mine,,todo,,false,2026-01-15T08:00:00.000Z,Alice,high\r\n',
      );
    });

    it('runs the query on its own runner and releases it after the last row', async () => {
      await read(service.exportCsv({}, me));

      expect(queryBuilder.setQueryRunner).toHaveBeenCalledWith(queryRunner);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('releases the runner when the download is cancelled halfway', async () => {
      // A cursor over a table too big to finish: it keeps fetching rows until destroyed
      let n = 0;
      const rows = new Readable({
        objectMode: true,
        read() {
          n += 1;
          this.push({ ...raw, task_id: n === 1 ? 'a' : `t${n}`, task_title: 'T', task_due_date: null });
        },
      });
      queryBuilder.stream.mockResolvedValue(rows);
      const csv = service.exportCsv({}, me);

      for await (const chunk of csv) {
        if (String(chunk).startsWith('a,')) break; // break destroys the stream, like a closed socket
      }

      await new Promise(setImmediate);
      expect(rows.destroyed).toBe(true);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('releases the runner when the query fails', async () => {
      queryBuilder.stream.mockRejectedValue(new Error('connection refused'));

      await expect(read(service.exportCsv({}, me))).rejects.toThrow('connection refused');
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    const TASK_ID = '00000000-0000-4000-8000-000000000001';
    const stored = () =>
      ({
        id: TASK_ID,
        title: 'Write report',
        description: 'Draft first',
        status: 'todo',
        dueDate: new Date('2026-03-20T00:00:00.000Z'),
        assigneeId: null,
        assignee: null,
      }) as Task;
    const assignedTo = (assignee: User) => ({ ...stored(), assigneeId: assignee.id, assignee }) as Task;

    beforeEach(() => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);
    });

    const admin = { id: ADMIN.id, role: 'admin' } as const;
    const user = me;

    it.each([
      ['title', { title: 'Renamed' }],
      ['description', { description: 'New text' }],
      ['description (null)', { description: null }],
      ['dueDate', { dueDate: '2026-04-01T00:00:00.000Z' }],
      ['dueDate (null)', { dueDate: null }],
    ])('refuses a user who sends %s, without reading the task (AC4.2)', async (_field, dto) => {
      await expect(service.update(TASK_ID, dto, user)).rejects.toThrow(ForbiddenException);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('lets a user change the priority (AC2.3)', async () => {
      repository.findOne.mockResolvedValue(stored());

      await expect(service.update(TASK_ID, { priority: 'high' }, user)).resolves.toMatchObject({
        priority: 'high',
      });
      expect(repository.save).toHaveBeenCalledWith({ ...stored(), priority: 'high' });
    });

    it('refuses a user who sends the priority together with an admin-only field', async () => {
      await expect(service.update(TASK_ID, { priority: 'high', title: 'Renamed' }, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['a day', '2026-04-01'],
      ['a time later that UTC day', '2026-04-01T15:00:00.000Z'],
    ])('saves a due date sent as %s as 00:00 UTC of that day (AC2.16)', async (_form, dueDate) => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(TASK_ID, { dueDate }, admin);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: new Date('2026-04-01T00:00:00.000Z') }),
      );
    });

    it('lets a user send none of the admin-only fields and changes nothing', async () => {
      repository.findOne.mockResolvedValue(stored());

      await expect(service.update(TASK_ID, {}, user)).resolves.toMatchObject({ id: TASK_ID, assignee: null });
      expect(repository.save).toHaveBeenCalledWith(stored());
    });

    it('saves every field an admin sends (AC4.1)', async () => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(
        TASK_ID,
        { title: 'Renamed', description: 'New text', status: 'done', dueDate: '2026-04-01T00:00:00.000Z' },
        admin,
      );

      expect(repository.save).toHaveBeenCalledWith({
        ...stored(),
        title: 'Renamed',
        description: 'New text',
        status: 'done',
        dueDate: new Date('2026-04-01T00:00:00.000Z'),
      });
    });

    it('clears the due date when dueDate is null (AC4.6)', async () => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(TASK_ID, { dueDate: null }, admin);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ dueDate: null }));
    });

    it('clears the description when description is null (AC4.6)', async () => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(TASK_ID, { description: null }, admin);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it('keeps the due date when dueDate is not sent', async () => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(TASK_ID, { title: 'Renamed' }, admin);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: new Date('2026-03-20T00:00:00.000Z') }),
      );
    });

    it('throws NotFoundException when an admin changes a deleted task (AC4.5, AC4.6)', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update(TASK_ID, { status: 'done' }, admin)).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('reads the task with its assignee', async () => {
      repository.findOne.mockResolvedValue(stored());

      await service.update(TASK_ID, {}, user);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: TASK_ID }, relations: { assignee: true } });
    });

    describe('assignee', () => {
      it.each([
        ['A to B (AC3.3)', ALICE, BOB],
        ['an unassigned task to themselves (AC3.4)', null, ALICE],
        ["someone else's task to themselves (AC3.4)", BOB, ALICE],
        ['an unassigned task to another user (AC3.5)', null, BOB],
      ])('lets a user assign %s', async (_case, from, to) => {
        repository.findOne.mockResolvedValue(from ? assignedTo(from) : stored());

        const result = await service.update(TASK_ID, { assigneeId: to.id }, user);

        expect(usersService.findActiveById).toHaveBeenCalledWith(to.id);
        expect(repository.save).toHaveBeenCalledWith({ ...stored(), assigneeId: to.id, assignee: to });
        expect(result.assignee).toEqual({ id: to.id, name: to.name });
      });

      it('lets a user unassign a task with null (AC3.3)', async () => {
        repository.findOne.mockResolvedValue(assignedTo(BOB));

        const result = await service.update(TASK_ID, { assigneeId: null }, user);

        expect(usersService.findActiveById).not.toHaveBeenCalled();
        expect(repository.save).toHaveBeenCalledWith(stored());
        expect(result.assignee).toBeNull();
      });

      it('keeps the assignee when assigneeId is not sent', async () => {
        repository.findOne.mockResolvedValue(assignedTo(BOB));

        await service.update(TASK_ID, { priority: 'high' }, user);

        expect(repository.save).toHaveBeenCalledWith({ ...assignedTo(BOB), priority: 'high' });
      });

      it('returns 400 and saves nothing for an id that is not an active user (AC3.6, D2)', async () => {
        repository.findOne.mockResolvedValue(stored());
        // Unknown ids and users removed from the users file both come back null
        usersService.findActiveById.mockResolvedValue(null);

        await expect(
          service.update(TASK_ID, { assigneeId: '00000000-0000-4000-8000-0000000000ff' }, admin),
        ).rejects.toThrow(new BadRequestException('assigneeId must be an existing user'));
        expect(repository.save).not.toHaveBeenCalled();
      });

      it('saves the last of two changes in a row, with no warning (AC3.17)', async () => {
        repository.findOne.mockImplementation(async () => stored());

        await service.update(TASK_ID, { assigneeId: ADMIN.id }, { id: BOB.id, role: 'user' });
        await service.update(TASK_ID, { assigneeId: BOB.id }, user);

        expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ assigneeId: BOB.id }));
      });

      it('returns only the id and name of the assignee, never the email, role or hash (AC3.7)', async () => {
        repository.findOne.mockResolvedValue(assignedTo(BOB));

        const result = await service.update(TASK_ID, {}, user);

        expect(result.assignee).toEqual({ id: BOB.id, name: 'Bob' });
        expect(result).not.toHaveProperty('assigneeId');
      });
    });

    describe('status', () => {
      it("lets the task's assignee change its status (AC3.10)", async () => {
        repository.findOne.mockResolvedValue(assignedTo(ALICE));

        await expect(service.update(TASK_ID, { status: 'done' }, user)).resolves.toMatchObject({ status: 'done' });
        expect(repository.save).toHaveBeenCalledWith({ ...assignedTo(ALICE), status: 'done' });
      });

      it.each([
        ['assigned to someone else (AC3.11)', () => assignedTo(BOB)],
        ['unassigned (AC3.11, TC-45)', () => stored()],
      ])('refuses a user who is not the assignee of a task %s', async (_case, task) => {
        repository.findOne.mockResolvedValue(task());

        await expect(service.update(TASK_ID, { status: 'done' }, user)).rejects.toThrow(ForbiddenException);
        expect(repository.save).not.toHaveBeenCalled();
      });

      it('takes the right away from the old assignee once the task is taken over (AC3.12, TC-46)', async () => {
        // Alice is the assignee; Bob takes the task over, then Alice sends a new status
        repository.findOne.mockResolvedValueOnce(assignedTo(ALICE)).mockResolvedValueOnce(assignedTo(BOB));

        await service.update(TASK_ID, { assigneeId: BOB.id }, { id: BOB.id, role: 'user' });
        await expect(service.update(TASK_ID, { status: 'done' }, user)).rejects.toThrow(ForbiddenException);

        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: BOB.id, status: 'todo' }));
      });

      // The status rule needs the task's assignee, so the task is read first: 404, not 403
      it('throws NotFoundException when a user changes the status of a deleted task', async () => {
        repository.findOne.mockResolvedValue(null);

        await expect(service.update(TASK_ID, { status: 'done' }, user)).rejects.toThrow(NotFoundException);
        expect(repository.save).not.toHaveBeenCalled();
      });

      it('checks the assignee before the change: a user cannot take a task and change its status at once', async () => {
        repository.findOne.mockResolvedValue(assignedTo(BOB));

        await expect(service.update(TASK_ID, { assigneeId: ALICE.id, status: 'done' }, user)).rejects.toThrow(
          ForbiddenException,
        );
        expect(repository.save).not.toHaveBeenCalled();
      });

      it("lets the admin change the status of anyone's task", async () => {
        repository.findOne.mockResolvedValue(assignedTo(BOB));

        await service.update(TASK_ID, { status: 'in_progress' }, admin);

        expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_progress' }));
      });
    });
  });

  describe('create', () => {
    it('saves the task with status todo when no status is sent (AC4.9)', async () => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      await service.create({ title: 'Write report' });

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'todo' }));
    });

    it('saves priority medium when no priority is sent (AC2.1)', async () => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      await service.create({ title: 'Write report' });

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ priority: 'medium' }));
    });

    it('saves the picked assignee (AC3.1)', async () => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      const result = await service.create({ title: 'Write report', assigneeId: BOB.id });

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: BOB.id, assignee: BOB }));
      expect(result.assignee).toEqual({ id: BOB.id, name: 'Bob' });
    });

    it.each([
      ['no assignee', {}],
      ['a null assignee', { assigneeId: null }],
    ])('saves the task as unassigned with %s (AC3.2)', async (_case, extra) => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      const result = await service.create({ title: 'Write report', ...extra });

      expect(usersService.findActiveById).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: null, assignee: null }));
      expect(result.assignee).toBeNull();
    });

    it('returns 400 and saves nothing for an assignee that is not an active user (AC3.6)', async () => {
      repository.save.mockReset();
      usersService.findActiveById.mockResolvedValue(null);

      await expect(
        service.create({ title: 'Write report', assigneeId: '00000000-0000-4000-8000-0000000000ff' }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it.each(['high', 'medium', 'low'] as const)('saves the picked priority %s (AC2.2)', async (priority) => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      await service.create({ title: 'Write report', priority });

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ priority }));
    });

    it.each([
      ['the picked day', '2026-03-20'],
      ['local midnight at UTC-5 (05:00 UTC)', '2026-03-20T05:00:00.000Z'],
      ['a timestamp with an offset (18:00 UTC)', '2026-03-20T23:00:00+05:00'],
      // No offset: read as UTC, not in the server's time zone
      ['a timestamp with no offset', '2026-03-20T03:00:00'],
    ])('saves a due date sent as %s as 00:00 UTC of its UTC day (AC2.16)', async (_form, dueDate) => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      await service.create({ title: 'Write report', dueDate });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: new Date('2026-03-20T00:00:00.000Z') }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when no task has the id', async () => {
      // TypeORM's findOne resolves to null (not undefined) when nothing matches
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the task with isOverdue when it exists', async () => {
      const task = {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Write report',
        description: null,
        status: 'todo',
        dueDate: null,
      } as Task;
      repository.findOne.mockResolvedValue(task);

      await expect(service.findOne(task.id)).resolves.toEqual({ ...task, assignee: null, isOverdue: false });
    });
  });

  describe('findAll', () => {
    const searchCalls = () =>
      queryBuilder.andWhere.mock.calls.filter(([sql]) => String(sql).includes(':search'));

    it('matches the title case-insensitively with ILIKE', async () => {
      await service.findAll({ search: 'report' }, me);

      expect(searchCalls()).toEqual([
        ["task.title ILIKE :search ESCAPE '\\'", { search: '%report%' }],
      ]);
    });

    it('trims spaces around the search term', async () => {
      await service.findAll({ search: '  report  ' }, me);

      expect(searchCalls()[0][1]).toEqual({ search: '%report%' });
    });

    it.each(['', '   '])('skips the search filter for an empty term (%j)', async (search) => {
      await service.findAll({ search }, me);

      expect(searchCalls()).toHaveLength(0);
    });

    it.each([
      ['%', '%\\%%'],
      ['_', '%\\_%'],
      ['a\\b', '%a\\\\b%'],
    ])('escapes LIKE wildcard %j so it matches literally', async (search, pattern) => {
      await service.findAll({ search }, me);

      expect(searchCalls()[0][1]).toEqual({ search: pattern });
    });

    it('applies the status filter together with the search', async () => {
      await service.findAll({ search: 'report', status: 'todo' }, me);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', { status: 'todo' });
      expect(searchCalls()).toHaveLength(1);
    });
  });
});
