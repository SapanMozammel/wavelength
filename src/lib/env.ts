const DEFAULT_API_BASE_URL = 'https://frontend-task-chatapp.onrender.com/api';
const DEFAULT_SOCKET_URL = 'https://frontend-task-chatapp.onrender.com';
/**
 * Dev-time fallback for the canonical site URL.
 *
 * Derived from `PORT` rather than pinned, because nothing in this project
 * should care which port the dev server landed on: `next dev` picks the next
 * free one when its first choice is taken, and a hardcoded value would then
 * describe a server that is not there. In production `NEXT_PUBLIC_SITE_URL` is
 * always set explicitly, so this value is never used.
 *
 * Read here and nowhere else — both consumers (`metadataBase` and the landing
 * page's JSON-LD) are Server Components, so this never has to agree with a
 * client render.
 */
const devSiteUrl = (): string => `http://localhost:${process.env.PORT ?? '3000'}`;

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
	NEXT_PUBLIC_SITE_URL: trimTrailingSlash(read('NEXT_PUBLIC_SITE_URL') ?? devSiteUrl()),
});
