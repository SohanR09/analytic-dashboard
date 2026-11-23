import { Router } from 'express';
import * as ctrl from '../controllers/member.controller';
import { P } from '../constants/permissions';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { addMemberSchema, memberParam, updateMemberSchema } from '../validators/member.validator';

// Mounted at /api/v1/businesses/:businessId/members
const router = Router({ mergeParams: true });

router.get('/', authorize(P.MEMBER_READ), ctrl.list);
router.post('/', authorize(P.MEMBER_MANAGE), validate({ body: addMemberSchema }), ctrl.add);
router.put('/:userId', authorize(P.MEMBER_MANAGE), validate({ params: memberParam, body: updateMemberSchema }), ctrl.update);
// Removal is authorised inside the service (members may also remove THEMSELVES, i.e. leave the business).
router.delete('/:userId', validate({ params: memberParam }), ctrl.remove);

export default router;
