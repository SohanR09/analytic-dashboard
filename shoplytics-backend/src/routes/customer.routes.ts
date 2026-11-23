import { Router } from 'express';
import * as ctrl from '../controllers/customer.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createCustomerSchema, customerAnalyticsQuery, listCustomersQuery, updateCustomerSchema } from '../validators/customer.validator';

// Mounted at /api/v1/businesses/:businessId/customers
const router = Router({ mergeParams: true });

router.get('/', authorize(P.CUSTOMER_READ), validate({ query: listCustomersQuery }), ctrl.list);
router.post('/', authorize(P.CUSTOMER_CREATE), validate({ body: createCustomerSchema }), ctrl.create);
router.get('/analytics', authorize(P.ANALYTICS_READ), limiters.analytics, validate({ query: customerAnalyticsQuery }), ctrl.analytics);
router.get('/:id', authorize(P.CUSTOMER_READ), validate({ params: idParam }), ctrl.get);
router.put('/:id', authorize(P.CUSTOMER_UPDATE), validate({ params: idParam, body: updateCustomerSchema }), ctrl.update);
router.delete('/:id', authorize(P.CUSTOMER_DELETE), validate({ params: idParam }), ctrl.remove);

export default router;
