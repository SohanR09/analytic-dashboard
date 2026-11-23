import { Router } from 'express';
import * as ctrl from '../controllers/product.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createProductSchema, listProductsQuery, productDetailQuery, updateProductSchema } from '../validators/product.validator';

// Mounted at /api/v1/businesses/:businessId/products
const router = Router({ mergeParams: true });

router.get('/', authorize(P.PRODUCT_READ), validate({ query: listProductsQuery }), ctrl.list);
router.post('/', authorize(P.PRODUCT_CREATE), validate({ body: createProductSchema }), ctrl.create);
router.get('/:id', authorize(P.PRODUCT_READ), validate({ params: idParam, query: productDetailQuery }), ctrl.get);
router.put('/:id', authorize(P.PRODUCT_UPDATE), validate({ params: idParam, body: updateProductSchema }), ctrl.update);
router.delete('/:id', authorize(P.PRODUCT_DELETE), validate({ params: idParam }), ctrl.remove);

export default router;
