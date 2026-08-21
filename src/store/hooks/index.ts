import type { AppDispatch, RootState } from '@/store';
import { useDispatch, useSelector } from 'react-redux';

// Use throughout the app instead of plain `useDispatch` / `useSelector`.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
