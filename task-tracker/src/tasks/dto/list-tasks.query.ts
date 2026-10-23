import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { TaskFilterQuery } from './task-filter.query';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
// Keeps OFFSET ((page - 1) * limit) a small integer: a huge page would reach Postgres as
// 2e+21 or overflow bigint and fail with a 500 instead of a 400
export const MAX_PAGE = 10_000;

// Only plain digit strings become numbers. Number() would also accept "1e2", "0x10" and
// " 5 ", so anything else is left as a string for @IsInt to reject.
const toInt = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListTasksQuery extends TaskFilterQuery {
  // 1-based page number; defaults to 1 in TasksService.findAll
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  // Page size; defaults to DEFAULT_PAGE_LIMIT in TasksService.findAll
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit?: number;
}
