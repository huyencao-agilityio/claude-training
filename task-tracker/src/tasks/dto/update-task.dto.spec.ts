import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateTaskDto } from './update-task.dto';

describe('UpdateTaskDto', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: object) => pipe.transform(body, { type: 'body', metatype: UpdateTaskDto });

  it('accepts null to clear the description and the due date (AC4.6)', async () => {
    await expect(validate({ description: null, dueDate: null })).resolves.toMatchObject({
      description: null,
      dueDate: null,
    });
  });

  it('rejects an empty due date', async () => {
    await expect(validate({ dueDate: '' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown status', async () => {
    await expect(validate({ status: 'urgent' })).rejects.toThrow(BadRequestException);
  });

  it.each(['high', 'medium', 'low'])('accepts priority %p (AC2.3)', async (priority) => {
    await expect(validate({ priority })).resolves.toMatchObject({ priority });
  });

  it.each(['urgent', 'High', '', null])('rejects priority %p', async (priority) => {
    await expect(validate({ priority })).rejects.toThrow(BadRequestException);
  });

  // null unassigns the task (AC3.3)
  it.each(['0e9769f6-5998-47bd-ad0f-811ce374384f', null])('accepts assigneeId %p (AC3.3)', async (assigneeId) => {
    await expect(validate({ assigneeId })).resolves.toMatchObject({ assigneeId });
  });

  it.each(['abc', '', 42])('rejects assigneeId %p', async (assigneeId) => {
    await expect(validate({ assigneeId })).rejects.toThrow(BadRequestException);
  });
});
