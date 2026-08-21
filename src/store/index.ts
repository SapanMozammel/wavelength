import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import sessionReducer, { SESSION_STORAGE_KEY, sessionCleared, sessionEstablished, sessionRestored } from './slices/session-slice';

const listenerMiddleware = createListenerMiddleware();

// Persist the session to localStorage from middleware rather than a component
// effect, so it runs once per action and stays out of the render path.
listenerMiddleware.startListening({
	matcher: isAnyOf(sessionEstablished, sessionRestored, sessionCleared),
	effect: (action, api) => {
		if (typeof window === 'undefined') {
			return;
		}
		if (sessionCleared.match(action)) {
			localStorage.removeItem(SESSION_STORAGE_KEY);
			return;
		}
		const { session } = api.getState() as RootState;
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: session.token, user: session.user }));
	},
});

export const makeStore = () =>
	configureStore({
		reducer: {
			session: sessionReducer,
		},
		middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
		devTools: process.env.NODE_ENV !== 'production',
	});

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
