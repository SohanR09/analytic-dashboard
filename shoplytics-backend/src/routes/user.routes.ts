import { Router } from 'express';
import * as ctrl from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { changePasswordSchema, updateProfileSchema } from '../validators/user.validator';

const router = Router();
router.use(authenticate, limiters.user);

router.get('/me', ctrl.getMe);
router.put('/me', validate({ body: updateProfileSchema }), ctrl.updateMe);
router.put('/me/password', limiters.auth, validate({ body: changePasswordSchema }), ctrl.changePassword);

export default router;
