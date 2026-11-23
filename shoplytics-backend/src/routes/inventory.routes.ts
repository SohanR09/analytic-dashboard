import { Router } from 'express';
import * as ctrl from '../controllers/inventory.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { objectId } from '../validators/common';
import { z } from 'zod';
import {
  inventoryAnalyticsQuery,
  listInventoryQuery,
  listMovementsQuery,
  lowStockQuery,
  updateStockSchema,
} from '../validators/inventory.validator';

// Mounted at /api/v1/businesses/:businessId/inventory
const router = Router({ mergeParams: true });

router.get('/', authorize(P.INVENTORY_READ), validate({ query: listInventoryQuery }), ctrl.list);
router.get('/analytics', authorize(P.ANALYTICS_READ), limiters.analytics, validate({ query: inventoryAnalyticsQuery }), ctrl.analytics);
router.get('/low-stock', authorize(P.INVENTORY_READ), validate({ query: lowStockQuery }), ctrl.lowStock);
router.get('/movements', authorize(P.INVENTORY_READ), validate({ query: listMovementsQuery }), ctrl.movements);
router.put('/:productId', authorize(P.INVENTORY_UPDATE), validate({ params: z.object({ productId: objectId }), body: updateStockSchema }), ctrl.updateStock);

export default router;
