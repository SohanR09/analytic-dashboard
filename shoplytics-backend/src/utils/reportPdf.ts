import PDFDocument from 'pdfkit';
import type { ReportColumn, ReportData } from '../services/report.service';

/**
 * Pure PDF rendering (pdfkit only - no DB / Redis imports) so it can run inside a worker thread.
 * Laying out thousands of rows is synchronous CPU work; see src/workers/reportPdf.worker.ts.
 */

export interface PdfJob {
  business: { name: string; currency: string };
  data: ReportData;
  generatedAt: Date;
}

const fmt = (col: ReportColumn, v: unknown, currency: string): string => {
  if (v === null || v === undefined || v === '') return '';
  if (col.type === 'money') return `${currency} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (col.type === 'percent') return `${Number(v).toFixed(2)}%`;
  if (col.type === 'number') return Number(v).toLocaleString('en-US');
  return String(v);
};

/** Renders a simple, paginated PDF (title, summary, table) and resolves with the finished file. */
export function renderReportPdf({ business, data, generatedAt }: PdfJob): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: data.columns.length > 6 ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

  doc.fillColor('#142B5C').fontSize(18).font('Helvetica-Bold').text(data.title);
  doc.moveDown(0.2).fillColor('#64748B').fontSize(9).font('Helvetica').text(`${business.name}  |  Generated ${generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`);

  const scalar = Object.entries(data.summary).filter(([, v]) => v !== null && typeof v !== 'object');
  if (scalar.length) {
    doc.moveDown(0.6).fillColor('#142B5C').fontSize(9).font('Helvetica-Bold').text(scalar.map(([k, v]) => `${k}: ${v}`).join('    '), { width });
  }
  doc.moveDown(0.8);

  const colWidth = width / data.columns.length;
  const header = (y: number) => {
    doc.rect(left, y - 3, width, 16).fill('#142B5C');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    data.columns.forEach((c, i) => doc.text(c.label, left + i * colWidth + 3, y, { width: colWidth - 6, height: 12, ellipsis: true, align: c.type === 'text' || c.type === 'date' ? 'left' : 'right' }));
    return y + 18;
  };

  let y = header(doc.y);
  data.rows.forEach((row, idx) => {
    if (y > bottom()) {
      doc.addPage();
      y = header(doc.page.margins.top);
    }
    if (idx % 2 === 1) doc.rect(left, y - 3, width, 14).fill('#EAF0FA');
    doc.fillColor('#142B5C').font('Helvetica').fontSize(8);
    data.columns.forEach((c, i) =>
      doc.text(fmt(c, row[c.key], business.currency), left + i * colWidth + 3, y, { width: colWidth - 6, height: 11, ellipsis: true, lineBreak: false, align: c.type === 'text' || c.type === 'date' ? 'left' : 'right' }),
    );
    y += 14;
  });
  if (!data.rows.length) doc.fillColor('#64748B').font('Helvetica-Oblique').fontSize(10).text('No data for the selected period.', left, y + 6);

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(`Page ${i + 1} of ${pages.count}`, left, doc.page.height - 30, { width, align: 'center', lineBreak: false });
  }
  doc.end();
  return done;
}
