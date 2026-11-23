import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authService } from '@/services/auth.service';
import { refreshSession, tokens } from '@/services/api';
import type { User } from '@/types';
import { errorMessage } from '@/utils/format';

interface AuthState { user: User | null; status: 'idle' | 'loading' | 'authenticated' | 'anonymous'; error: string | null }
const initial: AuthState = { user: null, status: 'idle', error: null };

/** On app start: if a refresh token exists, trade it for an access token and load the profile. */
export const bootstrap = createAsyncThunk('auth/bootstrap', async () => {
  if (!tokens.refresh) return null;
  if (!tokens.access && !(await refreshSession())) return null;
  return authService.me();
});
export const login = createAsyncThunk<User, { email: string; password: string; rememberMe: boolean }, { rejectValue: string }>(
  'auth/login', async (a, { rejectWithValue }) => {
    try { await authService.login(a.email, a.password, a.rememberMe); return await authService.me(); } catch (e) { return rejectWithValue(errorMessage(e)); }
  });
export const register = createAsyncThunk<User, { name: string; email: string; password: string; confirmPassword: string }, { rejectValue: string }>(
  'auth/register', async (a, { rejectWithValue }) => {
    try { await authService.register(a.name, a.email, a.password, a.confirmPassword); return await authService.me(); } catch (e) { return rejectWithValue(errorMessage(e)); }
  });
export const logout = createAsyncThunk('auth/logout', async () => { await authService.logout(); });

const slice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    sessionLost: (s) => { s.user = null; s.status = 'anonymous'; },
    userUpdated: (s, a: PayloadAction<Partial<User>>) => { if (s.user) s.user = { ...s.user, ...a.payload }; },
    clearError: (s) => { s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(bootstrap.pending, (s) => { s.status = 'loading'; })
      .addCase(bootstrap.fulfilled, (s, a) => { s.user = a.payload; s.status = a.payload ? 'authenticated' : 'anonymous'; })
      .addCase(bootstrap.rejected, (s) => { s.user = null; s.status = 'anonymous'; });
    for (const t of [login, register]) {
      b.addCase(t.pending, (s) => { s.error = null; })
        .addCase(t.fulfilled, (s, a) => { s.user = a.payload; s.status = 'authenticated'; })
        .addCase(t.rejected, (s, a) => { s.error = (a.payload as string) ?? 'Request failed'; });
    }
    b.addCase(logout.fulfilled, (s) => { s.user = null; s.status = 'anonymous'; });
  },
});
export const { sessionLost, userUpdated, clearError } = slice.actions;
export default slice.reducer;
