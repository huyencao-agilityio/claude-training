import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TASK_PRIORITIES, TASK_STATUSES, TaskPriority, TaskStatus } from '../task.entity';

export class UpdateTaskDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  // null clears the description (AC4.6); @IsOptional() lets it through
  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  // Any logged-in user may change it (AC2.3). Not @IsOptional(): that would let null through,
  // and the column is NOT NULL (a 500 instead of a 400)
  @ValidateIf((_dto, value) => value !== undefined)
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  // null clears the due date (AC4.6); "" is still rejected
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  // Any logged-in user may change it (AC3.3); null unassigns. The service checks it is an
  // active user (AC3.6).
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
