import { isSessionActive, verifyAccessToken } from '../services/session.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * AUTHENTICATION: requires `Authorization: Bearer <access token>` whose session is still alive in Redis.
 * Sets `req.user`. (What the user may DO is decided later by `authorize`.)
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw ApiError.unauthorized('Authentication required');

  const { userId, sid } = verifyAccessToken(header.slice(7).trim());
  if (!(await isSessionActive(sid, userId))) {
    throw new ApiError(401, 'Session expired or revoked, please log in again', { code: 'SESSION_REVOKED' });
  }

  req.user = { id: userId, sid };
  next();
});
