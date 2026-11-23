import type { AuthResult, User } from '@/types';
import { get, post, put, del, tokens, api } from './api';

export const authService = {
  async login(email: string, password: string, rememberMe: boolean) {
    const r = await post<AuthResult>('/auth/login', { email, password, rememberMe });
    tokens.set(r, rememberMe);
    return r.user;
  },
  async register(name: string, email: string, password: string, confirmPassword: string) {
    const r = await post<AuthResult>('/auth/register', { name, email, password, confirmPassword });
    tokens.set(r, false);
    return r.user;
  },
  me: () => get<User>('/auth/me'),
  async logout() {
    try { await api.post('/auth/logout'); } catch { /* already invalid */ }
    tokens.clear();
  },
  async logoutAll() { await post('/auth/logout-all'); tokens.clear(); },
  forgotPassword: (email: string) => post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post<{ message: string }>('/auth/reset-password', { token, password }),
  updateProfile: (data: { name?: string; profileImage?: string }) => put<User>('/users/me', data),
  changePassword: (currentPassword: string, newPassword: string) => put('/users/me/password', { currentPassword, newPassword }),
  sessions: () => get<{ id: string; createdAt: string; userAgent?: string; ip?: string; current: boolean }[]>('/auth/sessions'),
  revokeSession: (sid: string) => del(`/auth/sessions/${sid}`),
};
