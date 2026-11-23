import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../src/utils/csv';

describe('csv', () => {
  it('quotes and escapes cells', () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12.5)).toBe('"12.5"');
  });

  it('neutralises spreadsheet formula injection but keeps plain negative numbers', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe(`"'+1+1"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-cmd|calc')).toBe(`"'-cmd|calc"`);
    expect(csvCell(-42.5)).toBe('"-42.5"');
  });

  it('writes a BOM, header and CRLF rows', () => {
    const out = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 1, b: 'x' }]);
    expect(out.startsWith('﻿"A","B"\r\n"1","x"\r\n')).toBe(true);
  });
});
