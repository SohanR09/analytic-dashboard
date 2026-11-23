import { renderReportPdf, type PdfJob } from '../utils/reportPdf';

/** Piscina task: runs on a worker thread so PDF layout never blocks the API's event loop. */
export default function render(job: PdfJob): Promise<Buffer> {
  return renderReportPdf(job);
}
