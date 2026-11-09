import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListTasksQuery } from './list-tasks.query';

describe('ListTasksQuery', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (query: Record<string, string>): Promise<ListTasksQuery> =>
    pipe.transform(query, { type: 'query', metatype: ListTasksQuery });

  it.each(['active', 'overdue', 'done'])('accepts tab=%p', async (tab) => {
    await expect(parse({ tab })).resolves.toMatchObject({ tab });
  });

  it.each(['high', 'medium', 'low'])('accepts priority=%p (AC2.7)', async (priority) => {
    await expect(parse({ priority })).resolves.toMatchObject({ priority });
  });

  it('leaves tab and priority undefined when omitted', async () => {
    const query = await parse({});

    expect(query.tab).toBeUndefined();
    expect(query.priority).toBeUndefined();
  });

  it.each(['all', 'Active', ''])('rejects tab=%p with 400', async (tab) => {
    await expect(parse({ tab })).rejects.toThrow(BadRequestException);
  });

  it.each(['urgent', 'High', ''])('rejects priority=%p with 400', async (priority) => {
    await expect(parse({ priority })).rejects.toThrow(BadRequestException);
  });

  it.each(['me', 'unassigned'])('accepts assignee=%p (AC3.8, AC3.16)', async (assignee) => {
    await expect(parse({ assignee })).resolves.toMatchObject({ assignee });
  });

  it('leaves assignee undefined when omitted ("Anyone")', async () => {
    expect((await parse({})).assignee).toBeUndefined();
  });

  it.each(['bob', 'Me', 'anyone', ''])('rejects assignee=%p with 400', async (assignee) => {
    await expect(parse({ assignee })).rejects.toThrow(BadRequestException);
  });

  // The overdue filter was replaced by tab=overdue; the global pipe drops unknown params
  it('drops the old overdue param', async () => {
    await expect(parse({ overdue: 'true' })).resolves.not.toHaveProperty('overdue');
  });

  it('parses page and limit as numbers', async () => {
    await expect(parse({ page: '2', limit: '50' })).resolves.toMatchObject({ page: 2, limit: 50 });
  });

  it('leaves page and limit undefined when omitted', async () => {
    const query = await parse({});

    expect(query.page).toBeUndefined();
    expect(query.limit).toBeUndefined();
  });

  it('accepts limit at the bounds 1 and 100', async () => {
    await expect(parse({ limit: '1' })).resolves.toMatchObject({ limit: 1 });
    await expect(parse({ limit: '100' })).resolves.toMatchObject({ limit: 100 });
  });

  it('accepts page at the upper bound 10000', async () => {
    await expect(parse({ page: '10000' })).resolves.toMatchObject({ page: 10000 });
  });

  // Number() turns these into integers, but they are not plain integers
  const NOT_PLAIN_INTEGERS = ['1e2', '0x10', '0b1', ' 2 '];

  // Huge pages would turn into an OFFSET Postgres rejects (500), so they are a 400 here
  it.each(['0', '-1', '1.5', 'abc', '', '10001', '99999999999999999999', ...NOT_PLAIN_INTEGERS])(
    'rejects page=%p with 400',
    async (value) => {
      await expect(parse({ page: value })).rejects.toThrow(BadRequestException);
    },
  );

  it.each(['0', '101', '1.5', 'abc', '', ...NOT_PLAIN_INTEGERS])(
    'rejects limit=%p with 400',
    async (value) => {
      await expect(parse({ limit: value })).rejects.toThrow(BadRequestException);
    },
  );
});
