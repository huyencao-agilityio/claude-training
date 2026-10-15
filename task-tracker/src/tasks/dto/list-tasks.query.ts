import { IsIn, IsOptional, IsString } from 'class-validator';
import { TASK_STATUSES, TaskStatus } from '../task.entity';

export class ListTasksQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;
}
