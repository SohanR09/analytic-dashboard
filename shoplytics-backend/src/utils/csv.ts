/** CSV helpers. Cells starting with = + - @ are prefixed with ' so spreadsheet apps never run them as formulas. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // plain negative numbers stay numeric
  return `"${s.replace(/"/g, '""')}"`;
}

export interface CsvColumn {
  key: string;
  label: string;
}

export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c.key])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel opens UTF-8 correctly
}
