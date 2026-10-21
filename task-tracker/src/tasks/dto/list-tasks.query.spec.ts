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
});
