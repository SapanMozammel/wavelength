import { useSessionRestore } from '@/hooks/use-session-restore';
import { ApiError } from '@/lib/api/errors';
import { makeStore, type AppStore } from '@/store';
import { SESSION_STORAGE_KEY } from '@/store/slices/session-slice';
import type { Session, User } from '@/types/chat';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A persisted token is a claim, not proof. The JWT lasts seven days and a tab
 * can outlive it, so restore has to ask the server before the app calls anyone
 * signed in — and the answer is also the only way to learn the account was
 * renamed out from under the cached copy (quirk 14).
 *
 * The distinction these tests protect: *disproven* and *unverified* are not the
 * same thing. A 401 means the token is dead. A network failure means nothing at
 * all, and signing the user out over it would discard a working credential.
 */

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock('@/lib/api', () => ({ getCurrentUser }));

const STORED: Session = { token: 'jwt-token', user: { id: 'u1', name: 'Ada', phone: '+15551234567' } };

const wrapper = (store: AppStore) => {
	const Wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
	return Wrapper;
};

const restore = () => {
	const store = makeStore();
	renderHook(() => useSessionRestore(), { wrapper: wrapper(store) });
	return store;
};

beforeEach(() => {
	localStorage.clear();
	getCurrentUser.mockReset();
});

describe('useSessionRestore', () => {
	it('clears the session with no request at all when nothing is stored', async () => {
		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('anonymous'));
		expect(getCurrentUser).not.toHaveBeenCalled();
	});

	it('validates the stored token and restores the server’s user, not the cached one', async () => {
		// Quirk 14: another login on the same number may have renamed the
		// account since this copy was written, so the server wins.
		const renamed: User = { id: 'u1', name: 'Ada Lovelace', phone: '+15551234567' };
		getCurrentUser.mockResolvedValue(renamed);
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(STORED));

		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('authenticated'));
		expect(getCurrentUser).toHaveBeenCalledWith('jwt-token', expect.any(AbortSignal));
		expect(store.getState().session.user).toEqual(renamed);
	});

	it('clears an expired token — and keys on `kind`, not the status code', async () => {
		// Quirk 5: a missing token answers 400 and an invalid one answers 401.
		// Both are `unauthorized`; branching on status would misfile the 400.
		getCurrentUser.mockRejectedValue(new ApiError({ kind: 'unauthorized', status: 400, message: 'No token provided', code: 'NO_TOKEN' }));
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(STORED));

		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('anonymous'));
		expect(store.getState().session.token).toBeNull();
		expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
	});

	it('keeps an unverified session when the network failed rather than the token', async () => {
		getCurrentUser.mockRejectedValue(new ApiError({ kind: 'offline', status: 0, message: 'You appear to be offline.' }));
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(STORED));

		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('authenticated'));
		expect(store.getState().session.user).toEqual(STORED.user);
	});

	it('treats a hand-edited or half-written entry as no session, without throwing', async () => {
		localStorage.setItem(SESSION_STORAGE_KEY, '{"token":');

		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('anonymous'));
		expect(getCurrentUser).not.toHaveBeenCalled();
	});

	it('ignores a stored entry that has a token but no user', async () => {
		localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 'jwt-token', user: null }));

		const store = restore();

		await waitFor(() => expect(store.getState().session.status).toBe('anonymous'));
		expect(getCurrentUser).not.toHaveBeenCalled();
	});
});
