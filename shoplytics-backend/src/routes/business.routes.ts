import { Router } from 'express';
import * as ctrl from '../controllers/business.controller';
import { P } from '../constants/permissions';
import { authenticate } from '../middleware/authenticate';
import { authorize, businessContext } from '../middleware/authorize';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { createBusinessSchema, listBusinessesQuery, updateBusinessSchema } from '../validators/business.validator';
import categoryRoutes from './category.routes';
import customerRoutes from './customer.routes';
import dashboardRoutes from './dashboard.routes';
import inventoryRoutes from './inventory.routes';
import memberRoutes from './member.routes';
import orderRoutes from './order.routes';
import productRoutes from './product.routes';
import reportRoutes from './report.routes';
import revenueRoutes from './revenue.routes';
import salesRoutes from './sales.routes';

const router = Router();

router.use(authenticate, limiters.user); // who are you?  (+ per-user rate limit)

router.get('/', validate({ query: listBusinessesQuery }), ctrl.list);
router.post('/', validate({ body: createBusinessSchema }), ctrl.create);

// Everything below is scoped to ONE business the caller is a member of; `businessContext` loads their role.
router.use('/:businessId', businessContext);

router.get('/:businessId', authorize(P.BUSINESS_READ), ctrl.get);
router.put('/:businessId', authorize(P.BUSINESS_UPDATE), validate({ body: updateBusinessSchema }), ctrl.update);
router.put('/:businessId/default', authorize(P.BUSINESS_READ), ctrl.setDefault);
router.delete('/:businessId', authorize(P.BUSINESS_DELETE), ctrl.remove);

router.use('/:businessId/members', memberRoutes);
router.use('/:businessId/dashboard', dashboardRoutes);
router.use('/:businessId/sales', salesRoutes);
router.use('/:businessId/revenue', revenueRoutes);
router.use('/:businessId/inventory', inventoryRoutes);
router.use('/:businessId/products', productRoutes);
router.use('/:businessId/categories', categoryRoutes);
router.use('/:businessId/customers', customerRoutes);
router.use('/:businessId/orders', orderRoutes);
router.use('/:businessId/reports', reportRoutes);

export default router;
