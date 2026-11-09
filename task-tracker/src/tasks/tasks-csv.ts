import type { TaskResponse } from './tasks.service';

export const CSV_COLUMNS = [
  'id',
  'title',
  'description',
  'status',
  'dueDate',
  'isOverdue',
  'createdAt',
  // Just before priority (Q-40)
  'assignee',
  // Last column, lowercase (Q-39)
  'priority',
] as const;

// The assignee cell of a task nobody is assigned to (AC3.14)
export const UNASSIGNED = 'Unassigned';

// Lets Excel and other spreadsheet apps detect UTF-8 instead of guessing a legacy code page
const BOM = '\uFEFF';
// RFC 4180 record separator
const EOL = '\r\n';

// Spreadsheet apps run a cell starting with one of these as a formula (CSV injection);
// some skip a leading tab or CR and evaluate the rest (OWASP CSV injection list)
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function escapeCsvCell(value: string): string {
  // Prefix before quoting so the apostrophe lands inside the quotes
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const formatDate = (date: Date | null) => (date ? date.toISOString() : '');

function toRow(task: TaskResponse): string[] {
  return [
    task.id,
    task.title,
    task.description ?? '',
    task.status,
    formatDate(task.dueDate),
    String(task.isOverdue),
    formatDate(task.createdAt),
    task.assignee?.name ?? UNASSIGNED,
    task.priority,
  ];
}

const toLine = (cells: string[]) => cells.map(escapeCsvCell).join(',') + EOL;

// Start of every file: BOM, then the header row
export const CSV_HEADER = BOM + toLine([...CSV_COLUMNS]);

// One record, so a streamed export can write rows as they arrive
export const toCsvLine = (task: TaskResponse) => toLine(toRow(task));

// Builds the whole file: BOM, header row, then one row per task (header only when empty)
export function toCsv(tasks: TaskResponse[]): string {
  return CSV_HEADER + tasks.map(toCsvLine).join('');
}
