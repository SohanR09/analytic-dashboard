import { Router } from 'express';
import * as ctrl from '../controllers/order.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createOrderSchema, listOrdersQuery, updateOrderSchema } from '../validators/order.validator';

// Mounted at /api/v1/businesses/:businessId/orders
const router = Router({ mergeParams: true });

router.get('/', authorize(P.ORDER_READ), validate({ query: listOrdersQuery }), ctrl.list);
router.post('/', authorize(P.ORDER_CREATE), validate({ body: createOrderSchema }), ctrl.create);
router.get('/:id', authorize(P.ORDER_READ), validate({ params: idParam }), ctrl.get);
// Refund-related changes need order:refund on top of order:update (enforced in the service).
router.put('/:id', authorize(P.ORDER_UPDATE), validate({ params: idParam, body: updateOrderSchema }), ctrl.update);

export default router;
