import { configureStore, createListenerMiddleware, isAnyOf, isRejectedWithValue, type UnknownAction } from '@reduxjs/toolkit';
import chatReducer from './slices/chat-slice';
import sessionReducer, { SESSION_STORAGE_KEY, sessionCleared, sessionEstablished, sessionRestored } from './slices/session-slice';

const listenerMiddleware = createListenerMiddleware();

// Persist the session to localStorage from middleware rather than a component
// effect, so it runs once per action and stays out of the render path.
//
// Every storage call is wrapped. Safari in private mode throws
// `QuotaExceededError` from `setItem`, and an exception thrown inside listener
// middleware propagates out of `dispatch()` — so an unguarded write would
// white-screen the app on the line *after* a successful login. Failing to
// persist degrades to "log in again next visit", which is survivable; failing
// to catch is not. The read side (`@/lib/auth/storage`) fails soft to `null`
// for the same reason, so a write that never lands is already tolerated.
listenerMiddleware.startListening({
	matcher: isAnyOf(sessionEstablished, sessionRestored, sessionCleared),
	effect: (action, api) => {
		if (typeof window === 'undefined') {
			return;
		}
		try {
			if (sessionCleared.match(action)) {
				localStorage.removeItem(SESSION_STORAGE_KEY);
				return;
			}
			const { session } = api.getState() as RootState;
			localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: session.token, user: session.user }));
		} catch {
			// Storage unavailable (private mode, quota, disabled). The session
			// still lives in memory for this tab; only persistence is lost.
		}
	},
});

/** Narrows a rejected thunk's `ChatError` payload without reaching for `any`. */
const isUnauthorizedRejection = (payload: unknown): boolean => typeof payload === 'object' && payload !== null && 'kind' in payload && (payload as { kind: unknown }).kind === 'unauthorized';

/**
 * An expired token is handled here, once — not by every thunk deciding on its
 * own to log the user out.
 *
 * A dead session usually surfaces as several rejections at the same moment: the
 * conversation list, an open thread and an in-flight send can all fail
 * together. The token check makes that idempotent — `sessionCleared` is applied
 * synchronously, so the rejections queued behind it see a null token and do
 * nothing.
 */
listenerMiddleware.startListening({
	predicate: (action: UnknownAction) => isRejectedWithValue(action) && isUnauthorizedRejection(action.payload),
	effect: (_action, api) => {
		if ((api.getState() as RootState).session.token === null) {
			return;
		}
		api.dispatch(sessionCleared());
	},
});

export const makeStore = () =>
	configureStore({
		reducer: {
			session: sessionReducer,
			chat: chatReducer,
		},
		middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
		devTools: process.env.NODE_ENV !== 'production',
	});

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
