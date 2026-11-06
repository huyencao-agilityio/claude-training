import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../users/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { DEFAULT_PAGE_LIMIT, ListTasksQuery } from './dto/list-tasks.query';
import { TaskFilterQuery } from './dto/task-filter.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskPriority, TaskStatus } from './task.entity';
import { CSV_HEADER, toCsvLine } from './tasks-csv';

export type TaskResponse = Task & { isOverdue: boolean };

export type TaskPage = { items: TaskResponse[]; total: number; page: number; limit: number };

// A row from qb.stream(): raw, not an entity, with each column named <alias>_<column name>
type RawTaskRow = {
  task_id: string;
  task_title: string;
  task_description: string | null;
  task_status: TaskStatus;
  task_priority: TaskPriority;
  task_due_date: Date | null;
  task_created_at: Date;
  task_updated_at: Date;
};

// Escape LIKE special characters so the search term is matched literally.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

// Only an admin may change these fields (AC4.2). Priority is left out on purpose: any
// logged-in user may change it (AC2.3).
const ADMIN_ONLY_FIELDS = ['title', 'description', 'dueDate', 'status'] as const;

// 00:00 UTC of the day `date` falls on. A due date is a UTC calendar day (Q-51), and a task is
// overdue once that day has ended, so "today" starts at 00:00 UTC too (Q-34).
const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// A timestamp that names its offset ("Z", "+07:00", "-0500"); new Date() would read one without
// it in the server's own time zone
const HAS_OFFSET = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

// "2026-03-20" or any ISO timestamp -> 00:00 UTC of its UTC day, the only form a due date is saved
// in. A date alone is already read as UTC; a timestamp with no offset is read as UTC too.
const toDueDay = (value: string) =>
  startOfUtcDay(new Date(value.includes('T') && !HAS_OFFSET.test(value) ? `${value}Z` : value));

// High, then Medium, then Low (AC2.4). The column is text, so its own order would be alphabetical.
const PRIORITY_RANK = "CASE task.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END";

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
      priority: raw.task_priority,
      dueDate: raw.task_due_date,
      createdAt: raw.task_created_at,
      updatedAt: raw.task_updated_at,
    };
  }

  private filteredQuery(query: TaskFilterQuery): SelectQueryBuilder<Task> {
    // Urgent first, then newest first inside one priority (AC2.4, AC2.5). Many tasks share a
    // createdAt (the seed inserts 500 rows per statement), so id breaks the tie and keeps the
    // order stable: no task repeats or goes missing between pages.
    const qb = this.tasks
      .createQueryBuilder('task')
      .addSelect(PRIORITY_RANK, 'priority_rank')
      .orderBy('priority_rank', 'ASC')
      .addOrderBy('task.createdAt', 'DESC')
      .addOrderBy('task.id', 'DESC');

    const search = query.search?.trim();
    if (search) {
      qb.andWhere("task.title ILIKE :search ESCAPE '\\'", { search: `%${escapeLike(search)}%` });
    }
    // The Done tab has only done tasks, so the status filter is not applied there (AC2.10)
    if (query.status && query.tab !== 'done') {
      qb.andWhere('task.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('task.priority = :priority', { priority: query.priority });
    }
    // Same overdue rule as isOverdue in toResponse, but in SQL so the filter runs in the query
    const todayStart = startOfUtcDay(new Date());
    if (query.tab === 'active') {
      qb.andWhere("task.status != 'done' AND (task.dueDate IS NULL OR task.dueDate >= :todayStart)", {
        todayStart,
      });
    } else if (query.tab === 'overdue') {
      qb.andWhere("task.status != 'done' AND task.dueDate < :todayStart", { todayStart });
    } else if (query.tab === 'done') {
      qb.andWhere("task.status = 'done'");
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
      priority: dto.priority ?? 'medium',
      dueDate: dto.dueDate ? toDueDay(dto.dueDate) : null,
    });
    return this.toResponse(await this.tasks.save(task));
  }

  async update(id: string, dto: UpdateTaskDto, user: Pick<User, 'role'>): Promise<TaskResponse> {
    // Checked before the task is read, so a user learns nothing about it (null counts as sent)
    if (user.role !== 'admin' && ADMIN_ONLY_FIELDS.some((field) => dto[field] !== undefined)) {
      throw new ForbiddenException();
    }
    const task = await this.tasks.findOneBy({ id });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    Object.assign(task, {
      ...dto,
      // null clears the due date (AC4.6); new Date(null) would save 1970-01-01
      dueDate: dto.dueDate === undefined ? task.dueDate : dto.dueDate === null ? null : toDueDay(dto.dueDate),
    });
    return this.toResponse(await this.tasks.save(task));
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasks.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Task ${id} not found`);
    }
  }

  // One-off fix for due dates saved before T2 as the creator's local midnight, e.g. "20 March"
  // picked at UTC+7 is 19 March 17:00 UTC. Rounding to the nearest 00:00 UTC gives back the
  // picked day for any offset from UTC-11 to UTC+12; UTC+13/+14 land one day early, UTC-12 one
  // day late. Rows already at 00:00 UTC are left alone, so a second run changes nothing. The
  // task's updated_at is kept: nobody edited it. Returns the number of rows changed.
  async roundDueDatesToUtcDay(): Promise<number> {
    const result = await this.tasks
      .createQueryBuilder()
      .update(Task)
      .set({
        dueDate: () =>
          "date_trunc('day', (due_date AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'",
        // Without this, TypeORM sets updated_at to now for an @UpdateDateColumn
        updatedAt: () => 'updated_at',
      })
      .where('due_date IS NOT NULL')
      .andWhere("due_date <> date_trunc('day', due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'")
      .execute();
    return result.affected ?? 0;
  }

  private toResponse(task: Task): TaskResponse {
    // Overdue from 00:00 UTC on the day after the due date; a task due today is not (AC2.8, AC2.9)
    const isOverdue =
      task.status !== 'done' && task.dueDate !== null && task.dueDate < startOfUtcDay(new Date());
    return { ...task, isOverdue };
  }
}
