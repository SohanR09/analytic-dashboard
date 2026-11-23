import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { businessService } from '@/services/business.service';
import type { Business } from '@/types';
import { errorMessage } from '@/utils/format';

interface BusinessState { list: Business[]; activeId: string | null; active: Business | null; loading: boolean; error: string | null }
const initial: BusinessState = { list: [], activeId: null, active: null, loading: false, error: null };

export const fetchBusinesses = createAsyncThunk<Business[], void, { rejectValue: string }>('business/list', async (_, { rejectWithValue }) => {
  try { return await businessService.list(); } catch (e) { return rejectWithValue(errorMessage(e)); }
});
/** Selecting a business loads its details (incl. the caller's role and permissions). */
export const activateBusiness = createAsyncThunk<Business, string, { rejectValue: string }>('business/activate', async (id, { rejectWithValue }) => {
  try { return await businessService.get(id); } catch (e) { return rejectWithValue(errorMessage(e)); }
});

const slice = createSlice({
  name: 'business',
  initialState: initial,
  reducers: {
    deactivate: (s) => { s.activeId = null; s.active = null; },
    reset: () => initial,
  },
  extraReducers: (b) => {
    b.addCase(fetchBusinesses.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchBusinesses.fulfilled, (s, a) => { s.list = a.payload; s.loading = false; })
      .addCase(fetchBusinesses.rejected, (s, a) => { s.loading = false; s.error = a.payload ?? 'Failed to load businesses'; })
      .addCase(activateBusiness.pending, (s, a) => { s.activeId = a.meta.arg; s.loading = true; s.error = null; if (s.active?.id !== a.meta.arg) s.active = null; })
      .addCase(activateBusiness.fulfilled, (s, a) => { s.active = a.payload; s.activeId = a.payload.id; s.loading = false; })
      .addCase(activateBusiness.rejected, (s, a) => { s.loading = false; s.active = null; s.error = a.payload ?? 'Business not found'; });
  },
});
export const { deactivate, reset } = slice.actions;
export default slice.reducer;
