import { useMountEffect } from '@/hooks/use-mount-effect';
import { getCurrentUser } from '@/lib/api';
import { ApiError } from '@/lib/api/errors';
import { readPersistedSession } from '@/lib/auth/storage';
import { useAppDispatch } from '@/store/hooks';
import { sessionCleared, sessionRestored } from '@/store/slices/session-slice';

/**
 * Turns the persisted session from a claim into a fact, once per boot.
 *
 * A stored token is not proof of anything. The API issues a seven-day JWT and a
 * tab can sit open longer than that, so the token is validated against
 * `GET /auth/me` before the app treats anyone as signed in. The response is
 * also the only way to learn that the account was renamed — quirk 14 means
 * another login on the same phone number silently overwrites the stored name —
 * so the **server's** user is what gets restored, never the cached copy.
 *
 * Three outcomes, and the third is the one worth arguing about:
 *
 * - No stored session → `sessionCleared` immediately, with no request. There is
 *   nothing to validate, and firing `/auth/me` without a token would only earn
 *   a 400 on a server that can take a minute to answer it.
 * - `unauthorized` → `sessionCleared`. Note this branches on `kind`, not on the
 *   status code: a missing token answers 400 and an invalid one answers 401
 *   (quirk 5), so status alone would misfile half of the auth failures as
 *   validation errors.
 * - Anything else — offline, a network blip, the API's 30-60s cold start
 *   timing out — restores the cached session instead of clearing it. The token
 *   was not *disproven*, and signing someone out because their train went
 *   through a tunnel would discard a credential that is probably still valid.
 *   If it is not, the next real request answers 401 and the app clears then.
 */
export const useSessionRestore = (): void => {
	const dispatch = useAppDispatch();

	useMountEffect(() => {
		const persisted = readPersistedSession();

		if (persisted === null) {
			dispatch(sessionCleared());
			return;
		}

		const controller = new AbortController();

		void (async () => {
			try {
				const user = await getCurrentUser(persisted.token, controller.signal);
				dispatch(sessionRestored({ token: persisted.token, user }));
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}
				if (error instanceof ApiError && error.kind !== 'unauthorized') {
					dispatch(sessionRestored(persisted));
					return;
				}
				dispatch(sessionCleared());
			}
		})();

		return () => controller.abort();
	});
};
