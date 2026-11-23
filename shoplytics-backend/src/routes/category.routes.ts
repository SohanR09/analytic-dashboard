import { Router } from 'express';
import * as ctrl from '../controllers/category.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';
import { idParam } from '../validators/common';

// Mounted at /api/v1/businesses/:businessId/categories
const router = Router({ mergeParams: true });

router.get('/', authorize(P.CATEGORY_READ), ctrl.list);
router.post('/', authorize(P.CATEGORY_WRITE), validate({ body: createCategorySchema }), ctrl.create);
router.put('/:id', authorize(P.CATEGORY_WRITE), validate({ params: idParam, body: updateCategorySchema }), ctrl.update);
router.delete('/:id', authorize(P.CATEGORY_DELETE), validate({ params: idParam }), ctrl.remove);

export default router;
