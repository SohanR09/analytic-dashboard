import type { Request } from 'express';
import * as authService from '../services/auth.service';
import * as sessions from '../services/session.service';
import * as userService from '../services/user.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? undefined });

export const register = asyncHandler(async (req, res) => ok(res, await authService.register(req.body, meta(req)), 201));
export const login = asyncHandler(async (req, res) => ok(res, await authService.login(req.body, meta(req))));
export const refresh = asyncHandler(async (req, res) => ok(res, await authService.refresh(req.body.refreshToken)));

/** Revokes the current session immediately (the access token stops working at once). */
export const logout = asyncHandler(async (req, res) => {
  await sessions.revokeSession(req.user!.id, req.user!.sid);
  ok(res, { message: 'Logged out' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  const count = await sessions.revokeAllSessions(req.user!.id);
  ok(res, { message: 'Logged out of all devices', sessionsRevoked: count + 0 });
});

export const me = asyncHandler(async (req, res) => ok(res, await userService.getProfile(req.user!.id)));

export const listSessions = asyncHandler(async (req, res) => ok(res, await sessions.listSessions(req.user!.id, req.user!.sid)));

export const revokeSession = asyncHandler(async (req, res) => {
  if (!(await sessions.revokeSession(req.user!.id, req.params.sid))) throw ApiError.notFound('Session not found');
  ok(res, { message: 'Session revoked' });
});

export const forgotPassword = asyncHandler(async (req, res) => ok(res, await authService.forgotPassword(req.body.email)));
export const resetPassword = asyncHandler(async (req, res) => ok(res, await authService.resetPassword(req.body)));
