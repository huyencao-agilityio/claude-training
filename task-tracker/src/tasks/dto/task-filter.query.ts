import { IsIn, IsOptional, IsString } from 'class-validator';
import { TASK_PRIORITIES, TASK_STATUSES, TaskPriority, TaskStatus } from '../task.entity';

// Tabs of the task list (AC2.8 to AC2.10)
export const TASK_TABS = ['active', 'overdue', 'done'] as const;
export type TaskTab = (typeof TASK_TABS)[number];

// Assignee filter of the task list (AC3.8, AC3.16); omitted = anyone
export const ASSIGNEE_FILTERS = ['me', 'unassigned'] as const;
export type AssigneeFilter = (typeof ASSIGNEE_FILTERS)[number];

// Filters shared by the task list (GET /tasks) and the CSV export (GET /tasks/export)
export class TaskFilterQuery {
  @IsOptional()
  @IsString()
  search?: string;

  // Not applied on the Done tab (AC2.10)
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  // Omitted: every task, whatever its tab
  @IsOptional()
  @IsIn(TASK_TABS)
  tab?: TaskTab;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  // "me" is the logged-in user, so the same URL gives each user their own tasks
  @IsOptional()
  @IsIn(ASSIGNEE_FILTERS)
  assignee?: AssigneeFilter;
}
