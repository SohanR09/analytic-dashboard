import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Filters } from '@/types';

export const PRESETS: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' }, { value: 'last_90_days', label: 'Last 90 days' }, { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' }, { value: 'this_year', label: 'This year' }, { value: 'custom', label: 'Custom range' },
];
const initial: Filters = { preset: 'last_30_days' };

const slice = createSlice({
  name: 'filters',
  initialState: initial,
  reducers: {
    setPreset: (s, a: PayloadAction<string>) => { s.preset = a.payload; if (a.payload !== 'custom') { s.from = undefined; s.to = undefined; } },
    setCustomRange: (s, a: PayloadAction<{ from: string; to: string }>) => { s.preset = 'custom'; s.from = a.payload.from; s.to = a.payload.to; },
    setFilter: (s, a: PayloadAction<Partial<Pick<Filters, 'productId' | 'categoryId' | 'orderStatus'>>>) => Object.assign(s, a.payload),
    resetFilters: () => initial,
  },
});
export const { setPreset, setCustomRange, setFilter, resetFilters } = slice.actions;
export default slice.reducer;
