import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

describe('task title validation', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (metatype: new () => object, body: object) =>
    pipe.transform(body, { type: 'body', metatype });

  describe('CreateTaskDto', () => {
    it.each(['   ', '\t', ' \n '])('rejects a whitespace-only title (%j)', async (title) => {
      await expect(validate(CreateTaskDto, { title })).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty title', async () => {
      await expect(validate(CreateTaskDto, { title: '' })).rejects.toThrow(BadRequestException);
    });

    it('trims spaces around real text', async () => {
      await expect(validate(CreateTaskDto, { title: '  Buy milk  ' })).resolves.toMatchObject({
        title: 'Buy milk',
      });
    });

    it('checks the max length after trimming', async () => {
      const title = 'a'.repeat(200);
      await expect(validate(CreateTaskDto, { title: ` ${title} ` })).resolves.toMatchObject({
        title,
      });
      await expect(validate(CreateTaskDto, { title: `${title}a` })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('still rejects a non-string title', async () => {
      await expect(validate(CreateTaskDto, { title: 123 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdateTaskDto', () => {
    it.each(['   ', '\t', ' \n '])('rejects a whitespace-only title (%j)', async (title) => {
      await expect(validate(UpdateTaskDto, { title })).rejects.toThrow(BadRequestException);
    });

    it('trims spaces around real text', async () => {
      await expect(validate(UpdateTaskDto, { title: ' Buy milk ' })).resolves.toMatchObject({
        title: 'Buy milk',
      });
    });

    it('accepts an update without a title', async () => {
      await expect(validate(UpdateTaskDto, { status: 'done' })).resolves.toEqual({ status: 'done' });
    });
  });
});
