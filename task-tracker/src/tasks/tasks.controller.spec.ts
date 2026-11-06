import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

// Runs the real controller, service and validation over HTTP; only the repository is mocked
describe('GET /tasks/export', () => {
  const HEADER = 'id,title,description,status,dueDate,isOverdue,createdAt,priority';
  let app: INestApplication;
  let baseUrl: string;
  const queryBuilder = {
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setQueryRunner: jest.fn().mockReturnThis(),
    stream: jest.fn(),
  };
  const queryRunner = { release: jest.fn() };
  const repository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: { connection: { createQueryRunner: () => queryRunner } },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [TasksService, { provide: getRepositoryToken(Task), useValue: repository }],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same options as the global pipe in main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    Object.values(queryBuilder).forEach((fn) => fn.mockClear());
    queryBuilder.stream.mockReset().mockImplementation(async () => Readable.from([]));
    queryRunner.release.mockClear();
  });

  const get = (query = '', signal?: AbortSignal) =>
    fetch(`${baseUrl}/tasks/export${query}`, { signal });

  it('answers with text/csv in UTF-8', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  });

  it('downloads as tasks.csv', async () => {
    const res = await get();

    expect(res.headers.get('content-disposition')).toBe('attachment; filename="tasks.csv"');
  });

  it('starts the body with the UTF-8 BOM bytes', async () => {
    // res.text() would strip the BOM, so check the raw bytes
    const bytes = new Uint8Array(await (await get()).arrayBuffer());

    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('returns only the header row when no task matches', async () => {
    const body = Buffer.from(await (await get('?status=done')).arrayBuffer()).toString('utf8');

    expect(body).toBe(`\uFEFF${HEADER}\r\n`);
  });

  it('writes the matching tasks as rows', async () => {
    queryBuilder.stream.mockResolvedValue(
      Readable.from([
        {
          task_id: '00000000-0000-4000-8000-000000000001',
          task_title: '=cmd, "x"',
          task_description: 'Tiếng Việt',
          task_status: 'done',
          task_priority: 'low',
          task_due_date: null,
          task_created_at: new Date('2026-01-15T08:00:00.000Z'),
          task_updated_at: new Date('2026-01-15T08:00:00.000Z'),
        },
      ]),
    );

    const body = Buffer.from(await (await get()).arrayBuffer()).toString('utf8');

    expect(body).toBe(
      `\uFEFF${HEADER}\r\n` +
        '00000000-0000-4000-8000-000000000001,"\'=cmd, ""x""",Tiếng Việt,done,,false,' +
        '2026-01-15T08:00:00.000Z,low\r\n',
    );
  });

  it('passes search, status, tab and priority from the query string to the filter (AC2.12)', async () => {
    await get('?search=report&status=todo&tab=overdue&priority=high');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith("task.title ILIKE :search ESCAPE '\\'", {
      search: '%report%',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.status = :status', {
      status: 'todo',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.priority = :priority', {
      priority: 'high',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "task.status != 'done' AND task.dueDate < :todayStart",
      { todayStart: expect.any(Date) },
    );
  });

  it('ignores page and limit and exports every matching task', async () => {
    const res = await get('?page=2&limit=5');

    expect(res.status).toBe(200);
    expect(queryBuilder.skip).not.toHaveBeenCalled();
    expect(queryBuilder.take).not.toHaveBeenCalled();
  });

  it.each(['?status=archived', '?tab=late', '?priority=urgent', '?priority=High'])('rejects %s with 400', async (query) => {
    const res = await get(query);

    expect(res.status).toBe(400);
    expect(queryBuilder.stream).not.toHaveBeenCalled();
  });

  it('answers 500 without the database error message when the query fails', async () => {
    queryBuilder.stream.mockRejectedValue(new Error('password authentication failed'));
    // Expected error: check it is logged, without printing the stack in the test output
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const res = await get();

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('');
    expect(logError).toHaveBeenCalledWith(
      'CSV export failed: password authentication failed',
      expect.any(String),
    );
    logError.mockRestore();
  });

  it('stops the query and frees the connection when the client cancels the download', async () => {
    // A cursor over a table too big to finish: it keeps fetching rows until destroyed
    const rows = new Readable({
      objectMode: true,
      read() {
        this.push({
          task_id: 'a',
          task_title: 'T',
          task_description: null,
          task_status: 'todo',
          task_due_date: null,
          task_created_at: new Date(0),
          task_updated_at: new Date(0),
        });
      },
    });
    queryBuilder.stream.mockResolvedValue(rows);
    const abort = new AbortController();

    const res = await get('', abort.signal);
    await res.body!.getReader().read(); // the download has started
    abort.abort();

    await new Promise((resolve) => rows.once('close', resolve));
    await new Promise(setImmediate);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
