import { Download, Eye, FileText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, ConfirmDialog, DataTable, EmptyState, Field, Modal, PageHeader, Spinner, useToast } from '@/components/common/ui';
import { AnalyticsFilters } from '@/components/common/AnalyticsFilters';
import { ReportGenerating } from '@/components/common/ReportGenerating';
import { useBusiness, useFilters } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { reportService } from '@/services/resources.service';
import type { Report, ReportColumn } from '@/types';
import { date, dateTime, errorMessage, money, num, pct, titleCase } from '@/utils/format';
import { P } from '@/utils/permissions';

function cell(v: unknown, col: ReportColumn, currency: string) {
  if (v === null || v === undefined || v === '') return '—';
  switch (col.type) {
    case 'money': return money(Number(v), currency);
    case 'number': return num(Number(v));
    case 'percent': return pct(Number(v));
    case 'date': return date(String(v));
    default: return String(v);
  }
}

function ReportView({ report, onClose }: { report: Report | null; onClose: () => void }) {
  const { id, currency, can } = useBusiness();
  const toast = useToast();
  const full = useFetch(() => reportService.get(id, report!.id), [report?.id], !!report);
  const [dl, setDl] = useState<string | null>(null);
  const data = full.data?.data;
  const download = async (fmt: 'csv' | 'pdf') => {
    if (!report) return;
    setDl(fmt);
    try { await reportService.download(id, report.id, fmt, report.title); } catch (e) { toast('error', errorMessage(e)); } finally { setDl(null); }
  };
  return (
    <Modal open={!!report} onClose={onClose} title={report?.title ?? 'Report'} wide>
      {full.loading && !data && <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>}
      {full.error && <Alert>{full.error}</Alert>}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(data.summary).filter(([k, v]) => typeof v === 'number' && k !== 'truncated').slice(0, 6).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-lightblue px-3 py-2"><p className="text-xs text-muted">{titleCase(k.replace(/([A-Z])/g, '_$1'))}</p><p className="font-semibold">{/revenue|spent|value|sales|amount|discount|refund|tax|shipping/i.test(k) ? money(Number(v), currency) : num(Number(v))}</p></div>
            ))}
          </div>
          {data.summary.truncated === true && <Alert kind="info">Showing the first rows only. Download the export for the full data.</Alert>}
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-50"><tr>{data.columns.map((c) => <th key={c.key} className={`th ${c.type === 'text' || c.type === 'date' ? '' : 'text-right'}`}>{c.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">{data.rows.map((r, i) => <tr key={i}>{data.columns.map((c) => <td key={c.key} className={`td ${c.type === 'text' || c.type === 'date' ? '' : 'text-right'}`}>{cell(r[c.key], c, currency)}</td>)}</tr>)}</tbody></table>
            {data.rows.length === 0 && <EmptyState title="No data for this period" />}
          </div>
          {can(P.REPORT_GENERATE) !== undefined && (
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" disabled={!!dl} onClick={() => download('csv')}>{dl === 'csv' ? <Spinner /> : <Download className="h-4 w-4" />}CSV</button>
              <button className="btn-primary" disabled={!!dl} onClick={() => download('pdf')}>{dl === 'pdf' ? <Spinner /> : <Download className="h-4 w-4" />}PDF</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function Reports() {
  const { id, can } = useBusiness();
  const f = useFilters();
  const toast = useToast();
  const types = useFetch(() => reportService.types(id), [id]);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch(() => reportService.list(id, { page, limit: 10 }), [id, page]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<Report | null>(null);
  const [del, setDel] = useState<Report | null>(null);
  useEffect(() => { if (!type && types.data) setType(Object.values(types.data)[0]?.[0] ?? ''); }, [types.data, type]);

  const generate = async () => {
    setBusy(true);
    setReady(false);
    try {
      const r = await reportService.generate(id, type, f);
      setReady(true); // let the progress bar finish before opening the report
      await new Promise((res) => setTimeout(res, 450));
      toast('success', 'Report generated'); setPage(1); void list.reload(); setView(r);
    } catch (e) { toast('error', errorMessage(e)); } finally { setBusy(false); setReady(false); }
  };
  const remove = async () => {
    if (!del) return;
    try { await reportService.remove(id, del.id); toast('success', 'Report deleted'); setDel(null); void list.reload(); } catch (e) { toast('error', errorMessage(e)); }
  };
  return (
    <>
      <PageHeader title="Reports" subtitle="Generate a report for the date range in the top bar, then view or export it" />
      {can(P.REPORT_GENERATE) && (
        <Card title="New report" className="mb-6">
          {busy ? <ReportGenerating done={ready} label={`Generating ${titleCase(type)} report…`} /> : <>
          <AnalyticsFilters />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px]"><Field label="Report type">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Report type">
                {Object.entries(types.data ?? {}).map(([cat, list]) => <optgroup key={cat} label={titleCase(cat)}>{list.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</optgroup>)}
              </select></Field></div>
            <button className="btn-primary" disabled={busy || !type} onClick={generate}><FileText className="h-4 w-4" />Generate</button>
          </div></>}
        </Card>
      )}
      <h2 className="mb-3 text-lg font-semibold">Generated reports</h2>
      <DataTable rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(r) => r.id} meta={list.data?.meta} onPage={setPage}
        empty={<EmptyState title="No reports yet" hint="Generate your first report above." />}
        columns={[
          { header: 'Report', cell: (r) => <span className="font-medium">{r.title}</span> },
          { header: 'Type', cell: (r) => <Badge tone="blue">{titleCase(r.reportType)}</Badge> },
          { header: 'Created', cell: (r) => dateTime(r.createdAt) },
          { header: 'Status', cell: (r) => <Badge tone={r.status === 'COMPLETED' ? 'green' : r.status === 'FAILED' ? 'red' : 'amber'}>{titleCase(r.status)}</Badge> },
          { header: '', className: 'text-right', cell: (r) => (
            <div className="flex justify-end gap-1">
              <button className="btn-secondary !px-2.5 !py-1.5" disabled={r.status !== 'COMPLETED'} onClick={() => setView(r)}><Eye className="h-3.5 w-3.5" />View</button>
              {can(P.REPORT_DELETE) && <button className="btn-ghost !p-2 hover:!text-danger" aria-label={`Delete ${r.title}`} onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></button>}
            </div>) },
        ]} />
      <ReportView report={view} onClose={() => setView(null)} />
      <ConfirmDialog open={!!del} title="Delete report" message={<>Delete <b>{del?.title}</b>?</>} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
