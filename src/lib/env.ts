const DEFAULT_API_BASE_URL = 'https://frontend-task-chatapp.onrender.com/api';
const DEFAULT_SOCKET_URL = 'https://frontend-task-chatapp.onrender.com';
const DEFAULT_SITE_URL = 'http://localhost:8000';

const read = (key: string): string | undefined => {
	const value = process.env[key];
	return value === undefined || value === '' ? undefined : value;
};

/** Strip a trailing slash so callers can always join with a leading-slash path. */
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export type PublicEnv = {
	NEXT_PUBLIC_API_BASE_URL: string;
	NEXT_PUBLIC_SOCKET_URL: string;
	NEXT_PUBLIC_SITE_URL: string;
};

/**
 * All config for this app is public — the browser talks to the chat API
 * directly and there is no server-side secret. Read env only through this
 * object; never touch `process.env` at a call site.
 */
export const env: Readonly<PublicEnv> = Object.freeze({
	NEXT_PUBLIC_API_BASE_URL: trimTrailingSlash(read('NEXT_PUBLIC_API_BASE_URL') ?? DEFAULT_API_BASE_URL),
	NEXT_PUBLIC_SOCKET_URL: trimTrailingSlash(read('NEXT_PUBLIC_SOCKET_URL') ?? DEFAULT_SOCKET_URL),
	NEXT_PUBLIC_SITE_URL: trimTrailingSlash(read('NEXT_PUBLIC_SITE_URL') ?? DEFAULT_SITE_URL),
});
