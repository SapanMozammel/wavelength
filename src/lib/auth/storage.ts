import { SESSION_STORAGE_KEY } from '@/store/slices/session-slice';
import type { Session } from '@/types/chat';

/**
 * Reading the persisted session back out of `localStorage`.
 *
 * The write side lives in the store's listener middleware; this is the only
 * read side, shared by session restore and by the login form's "remember who
 * you were" pre-fill so the two cannot disagree about the shape on disk.
 *
 * Everything here fails to `null` rather than throwing. `localStorage` is not
 * guaranteed to exist (SSR) or to be readable (Safari private mode, a browser
 * configured to block site data), and the contents are user-editable — a
 * half-written or hand-edited entry is exactly as untrustworthy as no entry at
 * all, and neither should white-screen the app.
 */

const isPersistedUser = (value: unknown): value is Session['user'] => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const { id, name, phone } = value as Record<string, unknown>;
	return typeof id === 'string' && id !== '' && typeof name === 'string' && typeof phone === 'string';
};

const isPersistedSession = (value: unknown): value is Session => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const { token, user } = value as Record<string, unknown>;
	return typeof token === 'string' && token !== '' && isPersistedUser(user);
};

/**
 * The stored session, or `null` when there is none worth trusting.
 *
 * A returned session is a **claim**, never proof: the JWT lasts seven days and
 * a tab can sit open longer than that, so callers must validate it against
 * `/auth/me` before treating the user as signed in.
 */
export const readPersistedSession = (): Session | null => {
	if (typeof window === 'undefined') {
		return null;
	}

	let raw: string | null;
	try {
		raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
	} catch {
		return null;
	}

	if (raw === null || raw === '') {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		return isPersistedSession(parsed) ? parsed : null;
	} catch {
		return null;
	}
};
