import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { TASK_STATUSES, TaskStatus } from '../task.entity';

export class ListTasksQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  // Query params arrive as strings. Only "true"/"false" become booleans; anything
  // else is left as-is so @IsBoolean rejects it (Boolean("false") would be true).
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  overdue?: boolean;
}
