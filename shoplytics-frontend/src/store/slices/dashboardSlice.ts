import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { analyticsService } from '@/services/analytics.service';
import type { Dashboard, Filters } from '@/types';
import { errorMessage } from '@/utils/format';

interface DashState { data: Dashboard | null; loading: boolean; error: string | null; key: string | null }
const initial: DashState = { data: null, loading: false, error: null, key: null };

export const fetchDashboard = createAsyncThunk<Dashboard, { businessId: string; filters: Filters }, { rejectValue: string }>(
  'dashboard/fetch', async ({ businessId, filters }, { rejectWithValue }) => {
    try { return await analyticsService.dashboard(businessId, filters); } catch (e) { return rejectWithValue(errorMessage(e)); }
  });

const slice = createSlice({
  name: 'dashboard',
  initialState: initial,
  reducers: { clearDashboard: () => initial },
  extraReducers: (b) => {
    b.addCase(fetchDashboard.pending, (s, a) => {
      const key = `${a.meta.arg.businessId}`;
      if (s.key !== key) s.data = null; // never show another business's numbers while loading
      s.key = key; s.loading = true; s.error = null;
    })
      .addCase(fetchDashboard.fulfilled, (s, a) => { s.data = a.payload; s.loading = false; })
      .addCase(fetchDashboard.rejected, (s, a) => { s.loading = false; s.error = a.payload ?? 'Failed to load dashboard'; });
  },
});
export const { clearDashboard } = slice.actions;
export default slice.reducer;
