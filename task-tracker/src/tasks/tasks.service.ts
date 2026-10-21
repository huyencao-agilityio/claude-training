import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';

export type TaskResponse = Task & { isOverdue: boolean };

// Escape LIKE special characters so the search term is matched literally.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly tasks: Repository<Task>) {}

  async findAll(query: ListTasksQuery): Promise<TaskResponse[]> {
    const qb = this.tasks.createQueryBuilder('task').orderBy('task.createdAt', 'DESC');

    const search = query.search?.trim();
    if (search) {
      qb.andWhere("task.title ILIKE :search ESCAPE '\\'", { search: `%${escapeLike(search)}%` });
    }
    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status });
    }
    // Same rule as isOverdue in toResponse, but in SQL so the filter runs in the query
    if (query.overdue === true) {
      qb.andWhere("task.status != 'done' AND task.dueDate IS NOT NULL AND task.dueDate < :now", {
        now: new Date(),
      });
    } else if (query.overdue === false) {
      qb.andWhere("(task.status = 'done' OR task.dueDate IS NULL OR task.dueDate >= :now)", {
        now: new Date(),
      });
    }

    const tasks = await qb.getMany();
    return tasks.map((task) => this.toResponse(task));
  }

  async findOne(id: string): Promise<TaskResponse> {
    const task = await this.tasks.findOneBy({ id });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return this.toResponse(task);
  }

  async create(dto: CreateTaskDto): Promise<TaskResponse> {
    const task = this.tasks.create({
      title: dto.title,
      description: dto.description ?? null,
      status: dto.status ?? 'todo',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
    return this.toResponse(await this.tasks.save(task));
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskResponse> {
    const task = await this.tasks.findOneBy({ id });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    Object.assign(task, {
      ...dto,
      dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : task.dueDate,
    });
    return this.toResponse(await this.tasks.save(task));
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasks.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Task ${id} not found`);
    }
  }

  private toResponse(task: Task): TaskResponse {
    const isOverdue =
      task.status !== 'done' && task.dueDate !== null && task.dueDate.getTime() < Date.now();
    return { ...task, isOverdue };
  }
}
