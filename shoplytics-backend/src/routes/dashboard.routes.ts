import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { analyticsQuery } from '../validators/analytics.validator';

// Mounted at /api/v1/businesses/:businessId/dashboard
const router = Router({ mergeParams: true });
router.use(authorize(P.ANALYTICS_READ), limiters.analytics, validate({ query: analyticsQuery }));

router.get('/', ctrl.overview);
router.get('/revenue', ctrl.revenue);
router.get('/sales', ctrl.sales);
router.get('/top-products', ctrl.topProducts);
router.get('/order-status', ctrl.orderStatus);

export default router;
