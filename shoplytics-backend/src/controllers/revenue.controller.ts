import * as revenue from '../services/revenue.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import type { AnalyticsQuery, RecordsQuery } from '../validators/analytics.validator';

export const list = asyncHandler(async (req, res) => {
  const q = req.query as unknown as RecordsQuery;
  const { items, total, range, currency } = await revenue.listRevenue(req.business!, q);
  ok(res, { range, currency, records: items }, 200, pageMeta(q.page, q.limit, total));
});
export const analytics = asyncHandler(async (req, res) => ok(res, await revenue.getRevenueAnalytics(req.business!, req.query as unknown as AnalyticsQuery)));
export const trends = asyncHandler(async (req, res) => ok(res, await revenue.getRevenueTrends(req.business!, req.query as unknown as AnalyticsQuery)));
