import { Router } from 'express';
import * as ctrl from '../controllers/sales.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { analyticsQuery, recordsQuery } from '../validators/analytics.validator';

// Mounted at /api/v1/businesses/:businessId/sales
const router = Router({ mergeParams: true });
router.use(authorize(P.ANALYTICS_READ), limiters.analytics);

router.get('/', validate({ query: recordsQuery }), ctrl.list);
router.get('/analytics', validate({ query: analyticsQuery }), ctrl.analytics);
router.get('/trends', validate({ query: analyticsQuery }), ctrl.trends);

export default router;
