import type { TaskResponse } from './tasks.service';

export const CSV_COLUMNS = [
  'id',
  'title',
  'description',
  'status',
  'dueDate',
  'isOverdue',
  'createdAt',
] as const;

// Lets Excel and other spreadsheet apps detect UTF-8 instead of guessing a legacy code page
const BOM = '\uFEFF';
// RFC 4180 record separator
const EOL = '\r\n';

// Spreadsheet apps run a cell starting with one of these as a formula (CSV injection)
const FORMULA_PREFIX = /^[=+\-@]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function escapeCsvCell(value: string): string {
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
  ];
}

// Builds the whole file: BOM, header row, then one row per task (header only when empty)
export function toCsv(tasks: TaskResponse[]): string {
  const rows = [[...CSV_COLUMNS], ...tasks.map(toRow)];
  return BOM + rows.map((row) => row.map(escapeCsvCell).join(',') + EOL).join('');
}
