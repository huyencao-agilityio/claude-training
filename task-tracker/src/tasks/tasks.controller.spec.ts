import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

// Runs the real controller, service and validation over HTTP; only the repository is mocked
describe('GET /tasks/export', () => {
  const HEADER = 'id,title,description,status,dueDate,isOverdue,createdAt';
  let app: INestApplication;
  let baseUrl: string;
  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repository = { createQueryBuilder: jest.fn(() => queryBuilder) };

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
    queryBuilder.getMany.mockReset().mockResolvedValue([]);
  });

  const get = (query = '') => fetch(`${baseUrl}/tasks/export${query}`);

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
    queryBuilder.getMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: '=cmd, "x"',
        description: 'Tiếng Việt',
        status: 'done',
        dueDate: null,
        createdAt: new Date('2026-01-15T08:00:00.000Z'),
        updatedAt: new Date('2026-01-15T08:00:00.000Z'),
      },
    ]);

    const body = Buffer.from(await (await get()).arrayBuffer()).toString('utf8');

    expect(body).toBe(
      `\uFEFF${HEADER}\r\n` +
        '00000000-0000-4000-8000-000000000001,"\'=cmd, ""x""",Tiếng Việt,done,,false,' +
        '2026-01-15T08:00:00.000Z\r\n',
    );
  });

  it('passes search, status and overdue from the query string to the filter', async () => {
    await get('?search=report&status=todo&overdue=true');

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

  it('ignores page and limit and exports every matching task', async () => {
    const res = await get('?page=2&limit=5');

    expect(res.status).toBe(200);
    expect(queryBuilder.skip).not.toHaveBeenCalled();
    expect(queryBuilder.take).not.toHaveBeenCalled();
  });

  it.each(['?status=archived', '?overdue=yes'])('rejects %s with 400', async (query) => {
    const res = await get(query);

    expect(res.status).toBe(400);
    expect(queryBuilder.getMany).not.toHaveBeenCalled();
  });
});
