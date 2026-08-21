import type { WireApiError } from '@/types/api';

/** Field-level validation failure, as returned in `error.details`. */
export type FieldError = {
	path: string;
	message: string;
};

/**
 * Every failure the UI can encounter, narrowed to something a component can
 * branch on. The API's own status codes are not trustworthy on their own — a
 * missing token answers 400 while an invalid one answers 401, and a malformed
 * id answers 500 — so the kind is derived from status AND payload code.
 */
export type ApiErrorKind = 'network' | 'offline' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'rate-limited' | 'server' | 'unknown';

export class ApiError extends Error {
	readonly kind: ApiErrorKind;
	readonly status: number;
	readonly code: string | number | undefined;
	readonly fieldErrors: FieldError[];

	constructor(params: { kind: ApiErrorKind; status: number; message: string; code?: string | number; fieldErrors?: FieldError[] }) {
		super(params.message);
		this.name = 'ApiError';
		this.kind = params.kind;
		this.status = params.status;
		this.code = params.code;
		this.fieldErrors = params.fieldErrors ?? [];
	}

	/** True when retrying the exact same request could plausibly succeed. */
	get isRetryable(): boolean {
		return this.kind === 'network' || this.kind === 'offline' || this.kind === 'server' || this.kind === 'rate-limited';
	}

	/** True when the session is gone and the user must log in again. */
	get isAuthFailure(): boolean {
		return this.kind === 'unauthorized';
	}
}

const isWireApiError = (value: unknown): value is WireApiError => typeof value === 'object' && value !== null && 'error' in value && typeof (value as WireApiError).error?.message === 'string';

/**
 * Maps a failed response onto an `ApiErrorKind`.
 *
 * The two hand-written cases exist because the API contradicts itself:
 * `NO_TOKEN` is served as 400 though it is plainly an auth failure, and a
 * malformed conversation id escapes as a 500 carrying a raw Mongoose
 * `CastError` where a 400 belongs.
 */
const classify = (status: number, code: string | number | undefined, message: string): ApiErrorKind => {
	if (code === 'NO_TOKEN' || code === 'INVALID_TOKEN' || status === 401) {
		return 'unauthorized';
	}
	if (status === 403) {
		return 'forbidden';
	}
	if (status === 404) {
		return 'not-found';
	}
	if (status === 429) {
		return 'rate-limited';
	}
	if (status === 400) {
		return 'validation';
	}
	if (status === 500 && message.startsWith('Cast to ObjectId failed')) {
		return 'not-found';
	}
	if (status >= 500) {
		return 'server';
	}
	return 'unknown';
};

/** Builds an `ApiError` from a non-OK response body. */
export const toApiError = (status: number, body: unknown): ApiError => {
	if (isWireApiError(body)) {
		const { message, code, details } = body.error;
		return new ApiError({
			kind: classify(status, code, message),
			status,
			message,
			code,
			fieldErrors: details ?? [],
		});
	}
	return new ApiError({ kind: classify(status, undefined, ''), status, message: `Request failed with status ${status}` });
};

/** Wraps a thrown fetch/transport failure. */
export const toTransportError = (cause: unknown): ApiError => {
	const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
	return new ApiError({
		kind: offline ? 'offline' : 'network',
		status: 0,
		message: offline ? 'You appear to be offline.' : 'Could not reach the server.',
		// Spread rather than assign undefined — `exactOptionalPropertyTypes` treats
		// an explicit `undefined` as distinct from an absent property.
		...(cause instanceof Error ? { code: cause.name } : {}),
	});
};

/** Copy shown to the user. Deliberately never surfaces a raw driver message. */
export const userFacingMessage = (error: ApiError): string => {
	switch (error.kind) {
		case 'offline':
			return 'You are offline. Reconnecting when your connection returns.';
		case 'network':
			return 'We could not reach the server. Check your connection and try again.';
		case 'unauthorized':
			return 'Your session has expired. Please log in again.';
		case 'forbidden':
			return error.message || 'You do not have permission to do that.';
		case 'not-found':
			return 'That conversation could not be found.';
		case 'validation':
			return error.fieldErrors.at(0)?.message ?? error.message;
		case 'rate-limited':
			return 'Too many requests. Give it a moment and try again.';
		case 'server':
			return 'The server had a problem. This is usually temporary — try again.';
		default:
			return 'Something went wrong. Please try again.';
	}
};
