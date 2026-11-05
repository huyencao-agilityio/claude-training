import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    setQueryRunner: jest.fn().mockReturnThis(),
    stream: jest.fn(),
  };
  const queryRunner = { release: jest.fn() };
  const repository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn((task: Partial<Task>) => task),
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: { transaction: jest.fn(), connection: { createQueryRunner: () => queryRunner } },
  };

  beforeEach(async () => {
    repository.findOneBy.mockReset();
    repository.manager.transaction.mockReset();
    Object.values(queryBuilder).forEach((fn) => fn.mockClear());
    queryBuilder.getManyAndCount.mockReset().mockResolvedValue([[], 0]);
    queryBuilder.stream.mockReset().mockImplementation(async () => Readable.from([]));
    queryRunner.release.mockClear();
    const moduleRef = await Test.createTestingModule({
      providers: [TasksService, { provide: getRepositoryToken(Task), useValue: repository }],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  describe('findAll', () => {
    it('adds no overdue condition when overdue is omitted', async () => {
      await service.findAll({});

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('keeps only not-done tasks with a past due date when overdue is true', async () => {
      await service.findAll({ overdue: true });

      // excludes done tasks even when past due, and tasks with no due date
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "task.status != 'done' AND task.dueDate IS NOT NULL AND task.dueDate < :now",
        { now: expect.any(Date) },
      );
    });

    it('keeps done, undated and future tasks when overdue is false', async () => {
      await service.findAll({ overdue: false });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(task.status = 'done' OR task.dueDate IS NULL OR task.dueDate >= :now)",
        { now: expect.any(Date) },
      );
    });

    it('combines overdue with search and status', async () => {
      await service.findAll({ search: 'report', status: 'todo', overdue: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(3);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith("task.title ILIKE :search ESCAPE '\\'", {
        search: '%report%',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', {
        status: 'todo',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "task.status != 'done' AND task.dueDate IS NOT NULL AND task.dueDate < :now",
        { now: expect.any(Date) },
      );
    });
  });

  describe('findAll pagination', () => {
    it('returns the first page of 20 tasks by default', async () => {
      await expect(service.findAll({})).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('skips the tasks of the previous pages', async () => {
      await service.findAll({ page: 3, limit: 50 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(100);
      expect(queryBuilder.take).toHaveBeenCalledWith(50);
    });

    it('breaks createdAt ties by id so pages do not overlap', async () => {
      await service.findAll({});

      expect(queryBuilder.orderBy).toHaveBeenCalledTimes(1);
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('task.createdAt', 'DESC');
      expect(queryBuilder.addOrderBy).toHaveBeenCalledTimes(1);
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('task.id', 'DESC');
      // orderBy replaces any earlier ordering, so id must be added after createdAt
      expect(queryBuilder.addOrderBy.mock.invocationCallOrder[0]).toBeGreaterThan(
        queryBuilder.orderBy.mock.invocationCallOrder[0],
      );
    });

    // A transaction per list request costs extra round trips and holds a pooled connection
    it('reads the page and the total without opening a transaction', async () => {
      await service.findAll({});

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

      await expect(service.findAll({ status: 'todo', page: 3 })).resolves.toEqual({
        items: [{ ...task, isOverdue: true }],
        total: 41,
        page: 3,
        limit: 20,
      });
    });

    it('returns no items but the real total for a page past the end', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 41]);

      await expect(service.findAll({ page: 99 })).resolves.toEqual({
        items: [],
        total: 41,
        page: 99,
        limit: 20,
      });
    });
  });

  describe('exportCsv', () => {
    const HEADER = 'id,title,description,status,dueDate,isOverdue,createdAt';
    // Raw rows as qb.stream() yields them: <alias>_<column name>, not entities
    const raw = {
      task_description: null,
      task_status: 'todo',
      task_created_at: new Date('2026-01-15T08:00:00.000Z'),
      task_updated_at: new Date('2026-01-15T08:00:00.000Z'),
    };

    const read = async (stream: Readable) => {
      let csv = '';
      for await (const chunk of stream) csv += chunk;
      return csv;
    };

    it('applies the same search, status and overdue filters as findAll', async () => {
      const filters = { search: ' 50% ', status: 'todo', overdue: true } as const;
      await service.findAll(filters);
      // Each query takes its own `now`, which can land a millisecond apart
      const listCalls = queryBuilder.andWhere.mock.calls.map(([sql, params]) => [
        sql,
        'now' in params ? { ...params, now: expect.any(Date) } : params,
      ]);
      queryBuilder.andWhere.mockClear();

      await read(service.exportCsv(filters));

      expect(queryBuilder.andWhere.mock.calls).toEqual(listCalls);
      expect(listCalls).toHaveLength(3);
    });

    it('applies the overdue=false filter', async () => {
      await read(service.exportCsv({ overdue: false }));

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(task.status = 'done' OR task.dueDate IS NULL OR task.dueDate >= :now)",
        { now: expect.any(Date) },
      );
    });

    it('streams every matching task without paging', async () => {
      await read(service.exportCsv({}));

      expect(queryBuilder.skip).not.toHaveBeenCalled();
      expect(queryBuilder.take).not.toHaveBeenCalled();
      expect(queryBuilder.stream).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
    });

    it('keeps the list order: newest first, ties broken by id', async () => {
      await read(service.exportCsv({}));

      // orderBy replaces the whole ORDER BY, so a second call would silently drop this order
      expect(queryBuilder.orderBy.mock.calls).toEqual([['task.createdAt', 'DESC']]);
      expect(queryBuilder.addOrderBy.mock.calls).toEqual([['task.id', 'DESC']]);
    });

    it('returns only the header row when no task matches', async () => {
      await expect(read(service.exportCsv({ search: 'nothing matches' }))).resolves.toBe(
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

      await expect(read(service.exportCsv({}))).resolves.toBe(
        `\uFEFF${HEADER}\r\n` +
          'a,Late,,todo,2000-01-01T00:00:00.000Z,true,2026-01-15T08:00:00.000Z\r\n' +
          'b,Undated,,todo,,false,2026-01-15T08:00:00.000Z\r\n',
      );
    });

    it('runs the query on its own runner and releases it after the last row', async () => {
      await read(service.exportCsv({}));

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
      const csv = service.exportCsv({});

      for await (const chunk of csv) {
        if (String(chunk).startsWith('a,')) break; // break destroys the stream, like a closed socket
      }

      await new Promise(setImmediate);
      expect(rows.destroyed).toBe(true);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('releases the runner when the query fails', async () => {
      queryBuilder.stream.mockRejectedValue(new Error('connection refused'));

      await expect(read(service.exportCsv({}))).rejects.toThrow('connection refused');
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
      }) as Task;

    beforeEach(() => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);
    });

    const admin = { role: 'admin' } as const;
    const user = { role: 'user' } as const;

    it.each([
      ['title', { title: 'Renamed' }],
      ['description', { description: 'New text' }],
      ['description (null)', { description: null }],
      ['dueDate', { dueDate: '2026-04-01T00:00:00.000Z' }],
      ['dueDate (null)', { dueDate: null }],
      ['status', { status: 'done' as const }],
    ])('refuses a user who sends %s, without reading the task (AC4.2)', async (_field, dto) => {
      await expect(service.update(TASK_ID, dto, user)).rejects.toThrow(ForbiddenException);
      expect(repository.findOneBy).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('lets a user send none of the admin-only fields and changes nothing', async () => {
      repository.findOneBy.mockResolvedValue(stored());

      await expect(service.update(TASK_ID, {}, user)).resolves.toMatchObject(stored());
      expect(repository.save).toHaveBeenCalledWith(stored());
    });

    it('saves every field an admin sends (AC4.1)', async () => {
      repository.findOneBy.mockResolvedValue(stored());

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
      repository.findOneBy.mockResolvedValue(stored());

      await service.update(TASK_ID, { dueDate: null }, admin);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ dueDate: null }));
    });

    it('clears the description when description is null (AC4.6)', async () => {
      repository.findOneBy.mockResolvedValue(stored());

      await service.update(TASK_ID, { description: null }, admin);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it('keeps the due date when dueDate is not sent', async () => {
      repository.findOneBy.mockResolvedValue(stored());

      await service.update(TASK_ID, { title: 'Renamed' }, admin);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: new Date('2026-03-20T00:00:00.000Z') }),
      );
    });

    it('throws NotFoundException when an admin changes a deleted task (AC4.5, AC4.6)', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.update(TASK_ID, { status: 'done' }, admin)).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('saves the task with status todo when no status is sent (AC4.9)', async () => {
      repository.save.mockReset().mockImplementation(async (task: Task) => task);

      await service.create({ title: 'Write report' });

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'todo' }));
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when no task has the id', async () => {
      // TypeORM's findOneBy resolves to null (not undefined) when nothing matches
      repository.findOneBy.mockResolvedValue(null);

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
      repository.findOneBy.mockResolvedValue(task);

      await expect(service.findOne(task.id)).resolves.toEqual({ ...task, isOverdue: false });
    });
  });

  describe('findAll', () => {
    const searchCalls = () =>
      queryBuilder.andWhere.mock.calls.filter(([sql]) => String(sql).includes(':search'));

    it('matches the title case-insensitively with ILIKE', async () => {
      await service.findAll({ search: 'report' });

      expect(searchCalls()).toEqual([
        ["task.title ILIKE :search ESCAPE '\\'", { search: '%report%' }],
      ]);
    });

    it('trims spaces around the search term', async () => {
      await service.findAll({ search: '  report  ' });

      expect(searchCalls()[0][1]).toEqual({ search: '%report%' });
    });

    it.each(['', '   '])('skips the search filter for an empty term (%j)', async (search) => {
      await service.findAll({ search });

      expect(searchCalls()).toHaveLength(0);
    });

    it.each([
      ['%', '%\\%%'],
      ['_', '%\\_%'],
      ['a\\b', '%a\\\\b%'],
    ])('escapes LIKE wildcard %j so it matches literally', async (search, pattern) => {
      await service.findAll({ search });

      expect(searchCalls()[0][1]).toEqual({ search: pattern });
    });

    it('applies the status filter together with the search', async () => {
      await service.findAll({ search: 'report', status: 'todo' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', { status: 'todo' });
      expect(searchCalls()).toHaveLength(1);
    });
  });
});
