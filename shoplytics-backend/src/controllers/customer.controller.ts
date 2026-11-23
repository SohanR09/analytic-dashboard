import * as customers from '../services/customer.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';
import type { CustomerAnalyticsQuery, ListCustomersQuery } from '../validators/customer.validator';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await customers.listCustomers(req.business!.id, req.query as unknown as ListCustomersQuery);
  ok(res, items, 200, meta);
});
export const analytics = asyncHandler(async (req, res) => ok(res, await customers.getCustomerAnalytics(req.business!, req.query as unknown as CustomerAnalyticsQuery)));
export const get = asyncHandler(async (req, res) => ok(res, await customers.getCustomerDetail(req.business!, req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await customers.createCustomer(req.business!.id, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await customers.updateCustomer(req.business!.id, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => {
  await customers.deleteCustomer(req.business!.id, req.params.id);
  ok(res, { message: 'Customer deleted' });
});
