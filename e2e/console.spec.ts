import type { ConsoleMessage, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Every route must load without a console error.
 *
 * This exists because two real defects shipped past a green suite: a hydration
 * mismatch on locale-formatted timestamps, and a `<script>` rendered inside a
 * client component. Neither failed a test — the page still rendered, and axe
 * had nothing to say — but React was discarding and re-rendering a subtree on
 * every visit, which is exactly the class of bug that only ever shows up in the
 * console.
 *
 * Hydration warnings are surfaced as errors here deliberately. React calls them
 * "recoverable", and recovering means throwing away server-rendered markup and
 * doing it again on the client — which is the cost the server render was meant
 * to avoid.
 */

const STORAGE_KEY = 'wavelength.session';
const ME = { _id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const ALAN = { _id: 'u9', name: 'Alan Turing', phone: '+15559998888' };
/**
 * Mocked responses carry the CORS header the real server sends.
 *
 * Without it WebKit rejects every fulfilled cross-origin response with "due to
 * access control checks" while Chromium waves it through — so the mock has to
 * be faithful, or this spec fails on a browser difference rather than on
 * anything the app did.
 */
const json = (body: unknown, status = 200) => ({
	status,
	contentType: 'application/json',
	headers: { 'access-control-allow-origin': '*' },
	body: JSON.stringify(body),
});

const mock = async (page: Page) => {
	// Stub the socket rather than letting it dial the live server. The app opens
	// a real WebSocket on /chat, and a connection to a third-party demo host that
	// is torn down with the page logs an error in WebKit and Firefox — which says
	// nothing about whether *this app's* console is clean, and would make the
	// spec fail on someone else's uptime.
	await page.routeWebSocket(/socket\.io/, (ws) => {
		ws.onMessage(() => undefined);
	});
	await page.route('**/api/auth/me', (r) => r.fulfill(json(ME)));
	await page.route('**/health', (r) => r.fulfill(json({ status: 'ok' })));
	await page.route('**/api/conversations', (r) => r.fulfill(json({ data: [{ _id: 'c1', type: 'direct', lastMessage: {}, updatedAt: '2026-08-20T10:00:00.000Z', participant: ALAN }] })));
	await page.route('**/api/conversations/c1/messages**', (r) =>
		r.fulfill(json({ messages: [{ _id: 'm1', conversation: 'c1', sender: ALAN._id, text: 'hello there', createdAt: '2026-08-20T10:00:00.000Z' }], hasMore: false })),
	);
};

/** Noise that says nothing about this app's correctness. */
const isIrrelevant = (text: string): boolean =>
	text.includes('Download the React DevTools') || text.includes('[Fast Refresh]') || text.includes('web-vitals');

const collect = (page: Page): string[] => {
	const problems: string[] = [];
	page.on('console', (message: ConsoleMessage) => {
		const text = message.text();
		if (isIrrelevant(text)) {
			return;
		}
		// Hydration issues arrive as warnings; they are failures here.
		const isHydration = text.includes('Hydration failed') || text.includes("didn't match") || text.includes('script tag while rendering');
		if (message.type() === 'error' || isHydration) {
			problems.push(`[${message.type()}] ${text.split('\n')[0]?.slice(0, 200) ?? ''}`);
		}
	});
	page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message.split('\n')[0]?.slice(0, 200) ?? ''}`));
	return problems;
};

for (const route of ['/', '/login', '/chat']) {
	test(`${route} loads with a clean console`, async ({ page }) => {
		await mock(page);

		// Seeded before any navigation, deliberately. Seeding by visiting a page
		// first boots the app there, and the requests that boot starts are then
		// cancelled by the navigation under test — which WebKit reports as
		// "due to access control checks", a failure belonging entirely to the
		// test's own setup. `addInitScript` runs before page scripts, so there is
		// only ever one navigation and nothing to cancel.
		await page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key as string, value as string);
			},
			[STORAGE_KEY, JSON.stringify({ token: 't', user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const,
		);

		const problems = collect(page);
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		// Hydration reconciliation lands after load; give it a beat to complain.
		await page.waitForTimeout(1_500);

		expect(problems).toEqual([]);
	});
}
