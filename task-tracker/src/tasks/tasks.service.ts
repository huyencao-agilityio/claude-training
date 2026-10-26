import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CreateTaskDto } from './dto/create-task.dto';
import { DEFAULT_PAGE_LIMIT, ListTasksQuery } from './dto/list-tasks.query';
import { TaskFilterQuery } from './dto/task-filter.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskStatus } from './task.entity';
import { CSV_HEADER, toCsvLine } from './tasks-csv';

export type TaskResponse = Task & { isOverdue: boolean };

export type TaskPage = { items: TaskResponse[]; total: number; page: number; limit: number };

// A row from qb.stream(): raw, not an entity, with each column named <alias>_<column name>
type RawTaskRow = {
  task_id: string;
  task_title: string;
  task_description: string | null;
  task_status: TaskStatus;
  task_due_date: Date | null;
  task_created_at: Date;
  task_updated_at: Date;
};

// Escape LIKE special characters so the search term is matched literally.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly tasks: Repository<Task>) {}

  async findAll(query: ListTasksQuery): Promise<TaskPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    // The page and the COUNT are two statements without a shared snapshot, so a write in
    // between can make total drift by a few rows; the UI copes (a page past the end jumps back).
    const [tasks, total] = await this.filteredQuery(query)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items: tasks.map((task) => this.toResponse(task)), total, page, limit };
  }

  // Every task matching the filters as one CSV file, in the list order and without paging.
  // Rows are streamed from the database and written as they arrive, so memory stays flat
  // however many tasks match.
  exportCsv(query: TaskFilterQuery): Readable {
    return Readable.from(this.csvChunks(query));
  }

  private async *csvChunks(query: TaskFilterQuery): AsyncGenerator<string> {
    // TypeORM only frees a streaming connection when the stream ends or fails, not when the
    // download is cancelled and the stream destroyed, so we own the runner and release it here
    const runner = this.tasks.manager.connection.createQueryRunner();
    try {
      const rows = await this.filteredQuery(query).setQueryRunner(runner).stream();
      yield CSV_HEADER;
      for await (const raw of rows as AsyncIterable<RawTaskRow>) {
        yield toCsvLine(this.toResponse(this.fromRaw(raw)));
      }
    } finally {
      await runner.release();
    }
  }

  private fromRaw(raw: RawTaskRow): Task {
    return {
      id: raw.task_id,
      title: raw.task_title,
      description: raw.task_description,
      status: raw.task_status,
      dueDate: raw.task_due_date,
      createdAt: raw.task_created_at,
      updatedAt: raw.task_updated_at,
    };
  }

  private filteredQuery(query: TaskFilterQuery): SelectQueryBuilder<Task> {
    // Many tasks share a createdAt (the seed inserts 500 rows per statement), so id breaks
    // the tie and keeps the order stable: no task repeats or goes missing between pages.
    const qb = this.tasks
      .createQueryBuilder('task')
      .orderBy('task.createdAt', 'DESC')
      .addOrderBy('task.id', 'DESC');

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

    return qb;
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
