import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import auth from './slices/authSlice';
import business from './slices/businessSlice';
import dashboard from './slices/dashboardSlice';
import filters from './slices/filterSlice';

export const store = configureStore({ reducer: { auth, business, dashboard, filters } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
