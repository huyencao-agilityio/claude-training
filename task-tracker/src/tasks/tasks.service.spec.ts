import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const repository = { findOneBy: jest.fn(), createQueryBuilder: jest.fn(() => queryBuilder) };

  beforeEach(async () => {
    repository.findOneBy.mockReset();
    queryBuilder.andWhere.mockClear();
    queryBuilder.getMany.mockReset().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [TasksService, { provide: getRepositoryToken(Task), useValue: repository }],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  describe('findAll', () => {
    it('adds no overdue condition when overdue is omitted', async () => {
      await service.findAll({});

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('keeps only not-done tasks with a past due date when overdue is true', async () => {
      await service.findAll({ overdue: true });

      // excludes done tasks even when past due, and tasks with no due date
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "task.status != 'done' AND task.dueDate IS NOT NULL AND task.dueDate < :now",
        { now: expect.any(Date) },
      );
    });

    it('keeps done, undated and future tasks when overdue is false', async () => {
      await service.findAll({ overdue: false });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(task.status = 'done' OR task.dueDate IS NULL OR task.dueDate >= :now)",
        { now: expect.any(Date) },
      );
    });

    it('combines overdue with search and status', async () => {
      await service.findAll({ search: 'report', status: 'todo', overdue: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(3);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.title LIKE :search', {
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
