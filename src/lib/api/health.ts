import { env } from '@/lib/env';

/**
 * How the app understands the demo server's availability.
 *
 * Declared here rather than in `src/types/chat.ts` because the probe is the
 * only thing that can produce one of these values, and the type has no meaning
 * apart from it.
 *
 * | Status        | Meaning                                              |
 * |---------------|------------------------------------------------------|
 * | `unknown`     | No probe has completed yet — say nothing              |
 * | `waking`      | A probe has been outstanding past the narration threshold |
 * | `awake`       | A probe came back healthy                             |
 * | `unreachable` | Probes failed for the whole budget                    |
 */
export type WakeStatus = 'unknown' | 'waking' | 'awake' | 'unreachable';

/**
 * `/health` lives at the **origin root**, not under the `/api` base.
 *
 * This is quirk 6 and it is easy to get wrong in exactly one direction: the
 * same path under the `/api` base answers `404 {"error":{"code":"NOT_FOUND"}}`,
 * which is a perfectly well-formed response, so a probe pointed there would
 * never throw. It would simply report the server unreachable forever, on a
 * server that is up — the worst kind of bug, because it looks like it works.
 *
 * Verified by hand against the live deployment:
 *
 * ```
 * GET <origin>/health       → 200 {"status":"ok"}   (access-control-allow-origin: *)
 * GET <origin>/api + /health → 404 NOT_FOUND
 * ```
 *
 * `NEXT_PUBLIC_SOCKET_URL` is the origin (it has to be — socket.io serves
 * itself from `<origin>/socket.io/`), so it is the correct base, and using it
 * has a second benefit: warming this host is warming the socket host, so the
 * probe shortens the first real interaction rather than merely observing it.
 */
export const healthUrl = (): string => `${env.NEXT_PUBLIC_SOCKET_URL}/health`;

/**
 * One health check. Resolves `true` if the server answered healthily.
 *
 * The single API function that deliberately bypasses `request()`, because
 * `request()` prefixes `/api` and there is nothing there.
 *
 * Failure is a return value, not an exception: during a cold start Render can
 * answer 502 or drop the connection outright, and neither is exceptional —
 * both mean "not yet". The one thing that *is* rethrown is `AbortError`, so a
 * caller can tell "we gave up" from "the server said no".
 */
export const probeHealth = async (signal?: AbortSignal): Promise<boolean> => {
	try {
		const response = await fetch(healthUrl(), {
			method: 'GET',
			headers: { Accept: 'application/json' },
			cache: 'no-store',
			...(signal === undefined ? {} : { signal }),
		});
		return response.ok;
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			throw cause;
		}
		// DNS failure, CORS rejection, offline, connection reset mid-wake.
		return false;
	}
};
