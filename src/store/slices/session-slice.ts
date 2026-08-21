import type { Session, User } from '@/types/chat';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const SESSION_STORAGE_KEY = 'wavelength.session';

export type SessionState = {
	token: string | null;
	user: User | null;
	/** `unknown` until the persisted session has been checked against /auth/me. */
	status: 'unknown' | 'authenticated' | 'anonymous';
};

const initialState: SessionState = { token: null, user: null, status: 'unknown' };

const sessionSlice = createSlice({
	name: 'session',
	initialState,
	reducers: {
		sessionEstablished: (state, action: PayloadAction<Session>) => {
			state.token = action.payload.token;
			state.user = action.payload.user;
			state.status = 'authenticated';
		},
		sessionRestored: (state, action: PayloadAction<Session>) => {
			state.token = action.payload.token;
			state.user = action.payload.user;
			state.status = 'authenticated';
		},
		sessionCleared: (state) => {
			state.token = null;
			state.user = null;
			state.status = 'anonymous';
		},
	},
});

export const { sessionEstablished, sessionRestored, sessionCleared } = sessionSlice.actions;
export default sessionSlice.reducer;
