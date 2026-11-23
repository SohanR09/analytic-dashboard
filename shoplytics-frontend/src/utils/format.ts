export const money = (n: number | null | undefined, currency = 'USD', compact = false) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}) }).format(n ?? 0);
export const num = (n: number | null | undefined) => new Intl.NumberFormat().format(n ?? 0);
export const pct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`);
export const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const dateTime = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** Chart axis label for a bucket key like 2026-11-03, 2026-11 or 2026-W45. */
export const shortDate = (s: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : /^\d{4}-\d{2}$/.test(s) ? new Date(`${s}-01T00:00:00`) : null;
  if (!d) return s;
  return /^\d{4}-\d{2}$/.test(s) ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
export const errorMessage = (e: unknown): string => {
  const err = e as { response?: { data?: { message?: string; details?: { path?: string; message: string }[] } }; message?: string };
  const d = err?.response?.data;
  if (d?.details && Array.isArray(d.details) && d.details.length) return d.details.map((x) => (x.path ? `${x.path}: ${x.message}` : x.message)).join('; ');
  return d?.message ?? err?.message ?? 'Something went wrong';
};
