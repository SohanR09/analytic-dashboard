import path from 'path';
import Piscina from 'piscina';
import type { PdfJob } from '../utils/reportPdf';

/**
 * Worker-thread pool for PDF exports. A 20k-row report takes ~1.3s of pure CPU in pdfkit; on the main
 * thread that would freeze every other request for that long.
 *
 * Under `tsx` / vitest this file runs as .ts, so workers load the .ts worker through tsx's loader;
 * the compiled build (dist/) loads the plain .js worker.
 */
const isTs = path.extname(__filename) === '.ts';

let pool: Piscina | undefined;

function getPool(): Piscina {
  pool ??= new Piscina({
    filename: path.join(__dirname, '..', 'workers', `reportPdf.worker${isTs ? '.ts' : '.js'}`),
    execArgv: isTs ? ['--import', 'tsx'] : [],
    minThreads: 0, // no idle threads until someone exports a PDF
    maxThreads: 2, // PDF exports are rare; keep CPU for the API itself
    idleTimeout: 30_000,
  });
  return pool;
}

export async function renderPdfInWorker(job: PdfJob): Promise<Buffer> {
  const out: Uint8Array = await getPool().run(job);
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength); // structured clone hands back a plain Uint8Array
}

export async function closePdfPool(): Promise<void> {
  await pool?.destroy();
  pool = undefined;
}
