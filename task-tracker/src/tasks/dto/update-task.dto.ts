import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TASK_STATUSES, TaskStatus } from '../task.entity';

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

  // null clears the due date (AC4.6); "" is still rejected
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
