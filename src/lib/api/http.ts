import { env } from '@/lib/env';
import { toApiError, toTransportError } from './errors';

export type RequestOptions = {
	method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	body?: unknown;
	token?: string | undefined;
	query?: Record<string, string | number | undefined>;
	signal?: AbortSignal;
};

const buildUrl = (path: string, query: RequestOptions['query']): string => {
	const url = new URL(`${env.NEXT_PUBLIC_API_BASE_URL}${path}`);
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== undefined) {
			url.searchParams.set(key, String(value));
		}
	}
	return url.toString();
};

/**
 * The single fetch used by every endpoint.
 *
 * Responsibilities are narrow on purpose: attach the bearer token, serialise
 * JSON, and convert any failure — transport or HTTP — into an `ApiError`. It
 * performs no normalization; that belongs to `normalize.ts`.
 */
export const request = async <TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> => {
	const { method = 'GET', body, token, query, signal } = options;

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}
	if (token !== undefined) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	let response: Response;
	try {
		response = await fetch(buildUrl(path, query), {
			method,
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			...(signal === undefined ? {} : { signal }),
			cache: 'no-store',
		});
	} catch (cause) {
		if (cause instanceof DOMException && cause.name === 'AbortError') {
			throw cause;
		}
		throw toTransportError(cause);
	}

	// A 204 or an empty body is valid for the DELETE endpoints.
	const raw = await response.text();
	const payload: unknown = raw === '' ? null : safeParse(raw);

	if (!response.ok) {
		throw toApiError(response.status, payload);
	}

	return payload as TResponse;
};

/** The API can answer 500 with a non-JSON body; never let that throw a SyntaxError. */
const safeParse = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return { error: { message: raw.slice(0, 200), code: 'NON_JSON_RESPONSE' } };
	}
};
