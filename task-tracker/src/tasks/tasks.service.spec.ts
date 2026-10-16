import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const repository = { findOneBy: jest.fn() };

  beforeEach(async () => {
    repository.findOneBy.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [TasksService, { provide: getRepositoryToken(Task), useValue: repository }],
    }).compile();
    service = moduleRef.get(TasksService);
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
});
