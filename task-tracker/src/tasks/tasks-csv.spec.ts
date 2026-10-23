import { escapeCsvCell, toCsv } from './tasks-csv';
import { TaskResponse } from './tasks.service';

describe('tasks CSV', () => {
  const HEADER = 'id,title,description,status,dueDate,isOverdue,createdAt';
  const task = (overrides: Partial<TaskResponse> = {}): TaskResponse => ({
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Write report',
    description: 'Quarterly numbers',
    status: 'todo',
    dueDate: new Date('2026-03-01T09:30:00.000Z'),
    createdAt: new Date('2026-01-15T08:00:00.000Z'),
    updatedAt: new Date('2026-01-16T08:00:00.000Z'),
    isOverdue: true,
    ...overrides,
  });
  // Drops the BOM and the final record separator, then splits into records
  const records = (csv: string) => csv.slice(1).replace(/\r\n$/, '').split('\r\n');

  describe('toCsv', () => {
    it('starts with a UTF-8 BOM', () => {
      expect(toCsv([task()]).charCodeAt(0)).toBe(0xfeff);
    });

    it('writes only the header row when no task matches', () => {
      expect(toCsv([])).toBe(`\uFEFF${HEADER}\r\n`);
    });

    it('writes the columns in the agreed order', () => {
      expect(records(toCsv([task()]))).toEqual([
        HEADER,
        '00000000-0000-4000-8000-000000000001,Write report,Quarterly numbers,todo,' +
          '2026-03-01T09:30:00.000Z,true,2026-01-15T08:00:00.000Z',
      ]);
    });

    it('formats dates as ISO 8601 in UTC', () => {
      // Same instant given with a +07:00 offset comes out in UTC
      const csv = toCsv([task({ dueDate: new Date('2026-03-01T16:30:00+07:00') })]);

      expect(records(csv)[1].split(',')[4]).toBe('2026-03-01T09:30:00.000Z');
    });

    it('leaves the cell empty for a null description and due date', () => {
      const csv = toCsv([task({ description: null, dueDate: null, isOverdue: false })]);

      expect(records(csv)[1]).toBe(
        '00000000-0000-4000-8000-000000000001,Write report,,todo,,false,2026-01-15T08:00:00.000Z',
      );
    });

    it('writes one row per task, keeping the given order', () => {
      const csv = toCsv([task({ title: 'First' }), task({ title: 'Second' })]);

      expect(records(csv).map((row) => row.split(',')[1])).toEqual(['title', 'First', 'Second']);
    });

    it('ends every record with CRLF', () => {
      expect(toCsv([task()]).match(/\r\n/g)).toHaveLength(2);
      expect(toCsv([task()]).endsWith('\r\n')).toBe(true);
    });

    it('keeps a multi-line description inside one quoted cell', () => {
      const csv = toCsv([task({ description: 'line 1\nline 2' })]);

      expect(csv).toContain(',"line 1\nline 2",');
    });
  });

  describe('escapeCsvCell', () => {
    it('leaves a plain value as-is', () => {
      expect(escapeCsvCell('Write report')).toBe('Write report');
    });

    it('leaves an empty value empty', () => {
      expect(escapeCsvCell('')).toBe('');
    });

    it.each([
      ['a comma', 'Milk, eggs', '"Milk, eggs"'],
      ['a double quote', 'Say "hi"', '"Say ""hi"""'],
      ['a line feed', 'line 1\nline 2', '"line 1\nline 2"'],
      ['a CRLF', 'line 1\r\nline 2', '"line 1\r\nline 2"'],
      ['a carriage return', 'line 1\rline 2', '"line 1\rline 2"'],
    ])('quotes a value with %s', (_, value, expected) => {
      expect(escapeCsvCell(value)).toBe(expected);
    });

    it.each(['=', '+', '-', '@'])(
      'prefixes a value starting with %j with an apostrophe',
      (char) => {
        expect(escapeCsvCell(`${char}SUM(A1:A2)`)).toBe(`'${char}SUM(A1:A2)`);
      },
    );

    it('prefixes before quoting when a formula also needs quotes', () => {
      expect(escapeCsvCell('=HYPERLINK("http://x.test","click")')).toBe(
        '"\'=HYPERLINK(""http://x.test"",""click"")"',
      );
    });

    it('does not prefix a formula character that is not the first one', () => {
      expect(escapeCsvCell('a=b+c-d@e')).toBe('a=b+c-d@e');
    });

    it('does not prefix a value starting with a space before =', () => {
      expect(escapeCsvCell(' =1')).toBe(' =1');
    });
  });
});
