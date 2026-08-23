'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { sanitizeSearchTerm, searchUsers } from '@/lib/api';
import { ApiError, userFacingMessage } from '@/lib/api/errors';
import { useAppSelector } from '@/store/hooks';
import type { AsyncStatus, User } from '@/types/chat';
import { useCallback, useEffect, useState } from 'react';

/**
 * Directory search, with the three API faults on this path already absorbed.
 *
 * - **A blank `q` dumps the entire user directory** (quirk 4) — every other
 *   candidate's name and phone number. `searchUsers` short-circuits it, and the
 *   effect below never even gets that far: a blank term issues no request at all.
 * - **A leading `+` crashes the endpoint** (quirk 3) — `q` is interpolated into
 *   a Mongo `$regex` unescaped. `sanitizeSearchTerm` strips the metacharacters,
 *   which is also why `+1555…` searches as `1555…` and still matches.
 * - **You appear in your own results** (quirk 18), and starting a conversation
 *   with yourself opens a stranger's thread (quirk 9). The current user is
 *   filtered out here, and `isSelfMatch` remembers that they were there so the
 *   panel can say *"That's you."* rather than showing an empty result set that
 *   reads as a broken search.
 *
 * On the `useEffect`: there is no data-fetching library in this project, so
 * this is the `useData`-shaped hook that
 * `.claude/skills/workflow/no-use-effect.md` carves out. The race condition
 * that rule warns about is closed by the `AbortController` — the cleanup fires
 * on the next keystroke and on unmount, so at most one search is ever in
 * flight and a late response can never overwrite a newer one.
 */

export const SEARCH_DEBOUNCE_MS = 250;

const NO_USERS: readonly User[] = Object.freeze([]);

export type UseUserSearchResult = {
	query: string;
	/**
	 * The sanitized term is empty — including the `+`-only case, where
	 * sanitizing leaves nothing. Render the "type to search" hint, never an
	 * empty-results state: nothing was searched for.
	 */
	isBlank: boolean;
	/** Everyone found, minus the signed-in user. */
	results: readonly User[];
	status: AsyncStatus;
	error: string | null;
	/** The signed-in user was in the raw results — they searched for themselves. */
	isSelfMatch: boolean;
	onQueryChange: (value: string) => void;
	clear: () => void;
	retry: () => void;
};

export const useUserSearch = (): UseUserSearchResult => {
	const token = useAppSelector((state) => state.session.token);
	const currentUserId = useAppSelector((state) => state.session.user?.id ?? null);

	const [query, setQuery] = useState('');
	const [results, setResults] = useState<readonly User[]>(NO_USERS);
	const [fetchStatus, setFetchStatus] = useState<AsyncStatus>('idle');
	const [error, setError] = useState<string | null>(null);
	const [isSelfMatch, setIsSelfMatch] = useState(false);
	// Bumped by `retry` so the same term can be searched twice.
	const [attempt, setAttempt] = useState(0);

	const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
	const term = sanitizeSearchTerm(debouncedQuery);
	// Read from the *live* query, not the debounced one: clearing the field
	// should return to the hint immediately rather than 250ms later.
	const liveTerm = sanitizeSearchTerm(query);
	const isBlank = liveTerm === '';

	/**
	 * The field has moved and the debounce has not caught up — a search is
	 * coming. Derived rather than a `setStatus('loading')` in the change
	 * handler, which would strand the panel on "Searching" forever whenever an
	 * edit lands back on the term already searched ("grace" -> "gracex" ->
	 * "grace" inside 250ms): the debounced value never changes, so nothing
	 * would ever set it back.
	 */
	const isSettling = !isBlank && liveTerm !== term;

	useEffect(() => {
		// `isBlank` is a dependency, not just a guard: clearing the field and
		// retyping the same term inside the debounce window leaves `term`
		// unchanged, and without this the search would never re-run.
		if (isBlank || term === '' || token === null) {
			return;
		}

		const controller = new AbortController();
		setFetchStatus('loading');

		void (async () => {
			try {
				const found = await searchUsers(term, token, controller.signal);
				if (controller.signal.aborted) {
					return;
				}
				setIsSelfMatch(currentUserId !== null && found.some((user) => user.id === currentUserId));
				setResults(found.filter((user) => user.id !== currentUserId));
				setError(null);
				setFetchStatus('ready');
			} catch (cause) {
				if (controller.signal.aborted) {
					return;
				}
				setError(cause instanceof ApiError ? userFacingMessage(cause) : 'Could not search right now. Please try again.');
				setFetchStatus('error');
			}
		})();

		return () => {
			controller.abort();
		};
	}, [term, isBlank, attempt, token, currentUserId]);

	const onQueryChange = useCallback((value: string) => {
		setQuery(value);
		setError(null);

		if (sanitizeSearchTerm(value) === '') {
			setResults(NO_USERS);
			setIsSelfMatch(false);
			setFetchStatus('idle');
		}
	}, []);

	const clear = useCallback(() => {
		onQueryChange('');
	}, [onQueryChange]);

	const retry = useCallback(() => {
		setAttempt((current) => current + 1);
	}, []);

	// `idle` while blank and `loading` while settling, so the panel never shows
	// a stale "No one found" between a keystroke and the request it triggers.
	const status: AsyncStatus = isBlank ? 'idle' : isSettling ? 'loading' : fetchStatus;

	return { query, isBlank, results, status, error, isSelfMatch, onQueryChange, clear, retry };
};
