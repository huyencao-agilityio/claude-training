import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListTasksQuery } from './list-tasks.query';

describe('ListTasksQuery', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const parse = (query: Record<string, string>): Promise<ListTasksQuery> =>
    pipe.transform(query, { type: 'query', metatype: ListTasksQuery });

  it('parses overdue "true" as boolean true', async () => {
    await expect(parse({ overdue: 'true' })).resolves.toMatchObject({ overdue: true });
  });

  it('parses overdue "false" as boolean false', async () => {
    await expect(parse({ overdue: 'false' })).resolves.toMatchObject({ overdue: false });
  });

  it('leaves overdue undefined when omitted', async () => {
    const query = await parse({});

    expect(query.overdue).toBeUndefined();
  });

  it.each(['abc', '1', 'TRUE', ''])('rejects overdue=%p with 400', async (value) => {
    await expect(parse({ overdue: value })).rejects.toThrow(BadRequestException);
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
