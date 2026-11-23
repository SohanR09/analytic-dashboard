import * as analytics from '../services/analytics.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import type { AnalyticsQuery } from '../validators/analytics.validator';

const q = (req: { query: unknown }) => req.query as AnalyticsQuery;

export const overview = asyncHandler(async (req, res) => ok(res, await analytics.getDashboard(req.business!, q(req))));
export const revenue = asyncHandler(async (req, res) => ok(res, await analytics.getRevenueOverview(req.business!, q(req))));
export const sales = asyncHandler(async (req, res) => ok(res, await analytics.getSalesOverview(req.business!, q(req))));
export const topProducts = asyncHandler(async (req, res) => ok(res, await analytics.getTopProducts(req.business!, q(req))));
export const orderStatus = asyncHandler(async (req, res) => ok(res, await analytics.getOrderStatus(req.business!, q(req))));
