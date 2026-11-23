import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { limiters } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParam,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', limiters.auth, validate({ body: registerSchema }), ctrl.register);
router.post('/login', limiters.auth, validate({ body: loginSchema }), ctrl.login);
router.post('/refresh', limiters.refresh, validate({ body: refreshSchema }), ctrl.refresh);
router.post('/forgot-password', limiters.forgot, validate({ body: forgotPasswordSchema }), ctrl.forgotPassword);
router.post('/reset-password', limiters.auth, validate({ body: resetPasswordSchema }), ctrl.resetPassword);

// authenticated
router.post('/logout', authenticate, ctrl.logout);
router.post('/logout-all', authenticate, ctrl.logoutAll);
router.get('/me', authenticate, ctrl.me);
router.get('/sessions', authenticate, ctrl.listSessions);
router.delete('/sessions/:sid', authenticate, validate({ params: sessionIdParam }), ctrl.revokeSession);

export default router;
