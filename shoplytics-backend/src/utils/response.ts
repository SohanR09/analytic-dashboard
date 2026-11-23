import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, status = 200, meta?: PageMeta) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Slice an in-memory array into a page and build the matching meta. */
export function paginate<T>(rows: T[], page: number, limit: number) {
  return { items: rows.slice((page - 1) * limit, page * limit), meta: pageMeta(page, limit, rows.length) };
}
