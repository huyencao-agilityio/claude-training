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
});
