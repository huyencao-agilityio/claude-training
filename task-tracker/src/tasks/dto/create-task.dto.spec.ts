import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateTaskDto } from './create-task.dto';

describe('CreateTaskDto priority', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: object) => pipe.transform(body, { type: 'body', metatype: CreateTaskDto });

  it('leaves the priority undefined when it is not sent, so the service saves medium (AC2.1)', async () => {
    const dto = (await validate({ title: 'Write report' })) as CreateTaskDto;

    expect(dto.priority).toBeUndefined();
  });

  it.each(['high', 'medium', 'low'])('accepts priority %p (AC2.2)', async (priority) => {
    await expect(validate({ title: 'Write report', priority })).resolves.toMatchObject({ priority });
  });

  it.each(['urgent', 'High', '', 1])('rejects priority %p with 400 (AC2.2, TC-17)', async (priority) => {
    await expect(validate({ title: 'Write report', priority })).rejects.toThrow(BadRequestException);
  });

  it.each(['2026-03-20', '2026-03-20T00:00:00.000Z'])('accepts the due date %p', async (dueDate) => {
    await expect(validate({ title: 'Write report', dueDate })).resolves.toMatchObject({ dueDate });
  });
});
