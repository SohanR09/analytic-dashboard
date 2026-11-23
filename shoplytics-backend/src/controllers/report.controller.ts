import { renderPdfInWorker } from '../services/pdf.pool';
import * as reports from '../services/report.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import { REPORT_CATEGORIES } from '../validators/report.validator';

export const catalog = asyncHandler(async (_req, res) => ok(res, REPORT_CATEGORIES));

export const list = asyncHandler(async (req, res) => {
  const q = req.query as unknown as { page: number; limit: number; reportType?: string };
  const { items, total } = await reports.listReports(req.business!.id, q);
  ok(res, items, 200, pageMeta(q.page, q.limit, total));
});
export const generate = asyncHandler(async (req, res) => ok(res, await reports.generateReport(req.business!, req.user!.id, req.body), 201));
export const get = asyncHandler(async (req, res) => ok(res, await reports.getReport(req.business!.id, req.params.reportId)));
export const remove = asyncHandler(async (req, res) => {
  await reports.deleteReport(req.business!.id, req.params.reportId);
  ok(res, { message: 'Report deleted' });
});

export const exportReport = asyncHandler(async (req, res) => {
  const { report, data } = await reports.loadReportData(req.business!.id, req.params.reportId);
  const format = (req.query as { format: 'csv' | 'pdf' }).format;
  const name = reports.exportFileName(report.title, report.id, format);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return void res.send(reports.reportToCsv(data));
  }
  // Rendered on a worker thread: pdfkit layout is CPU-bound and would otherwise block every other request.
  const pdf = await renderPdfInWorker({ business: { name: req.business!.name, currency: req.business!.currency }, data, generatedAt: report.createdAt });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.end(pdf);
});
