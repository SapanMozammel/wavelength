import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { env } from '../src/lib/env';
import { expect, test } from './fixtures';

/**
 * Real-time delivery, proven with two real users.
 *
 * > Real-time updates — new incoming messages should appear automatically,
 * > without the user needing to refresh.
 *
 * This is the one spec in the suite that talks to the **live API**, and it has
 * to. Everything else mocks the network for determinism, but a mock cannot
 * prove that a message sent by one browser arrives in another — the whole
 * mechanism under test is the server's socket fan-out, and a stubbed socket
 * would only assert that the client wires up to itself.
 *
 * Two consequences, both handled rather than hoped away:
 *
 * - **The server sleeps.** A free Render instance cold-starts for 30-60s, so
 *   this spec is `slow()` and waits generously rather than failing fast.
 * - **Login is account creation.** Phone numbers are stamped per run, so a
 *   second run — or a parallel CI job — never collides with an earlier one or
 *   renames somebody else's account.
 */

const STORAGE_KEY = 'wavelength.session';
const API = env.NEXT_PUBLIC_API_BASE_URL;

type Identity = { token: string; id: string; name: string; phone: string };

const login = async (request: APIRequestContext, phone: string, name: string): Promise<Identity> => {
	const response = await request.post(`${API}/auth/login`, { data: { phone, name } });
	expect(response.ok(), `login failed for ${name}`).toBe(true);
	const body = (await response.json()) as { token: string; user: { _id: string; name: string; phone: string } };
	return { token: body.token, id: body.user._id, name: body.user.name, phone: body.user.phone };
};

/** Puts a session on disk for the app's origin, so the UI boots signed in. */
const signIn = async (page: Page, identity: Identity) => {
	await page.goto('/__seed');
	await page.evaluate(
		([key, value]) => window.localStorage.setItem(key, value),
		[STORAGE_KEY, JSON.stringify({ token: identity.token, user: { id: identity.id, name: identity.name, phone: identity.phone } })] as const
	);
};

const openConversationWith = async (page: Page, peerName: string) => {
	await page.goto('/chat');
	await page.getByRole('button', { name: new RegExp(peerName) }).first().click();
	await expect(page.getByRole('log')).toBeVisible();
};

const composer = (page: Page) => page.getByRole('textbox', { name: /message/i });

test.describe('real-time delivery', () => {
	test.slow();

	let alice: Identity;
	let bob: Identity;

	test.beforeAll(async ({ playwright }, workerInfo) => {
		const request = await playwright.request.newContext();
		// `beforeAll` runs once per worker, and two workers starting in the same
		// millisecond would otherwise register the *same* phone numbers
		// concurrently — a duplicate insert on a unique index, which surfaces as
		// a failed login rather than anything that names the real cause. The
		// worker index makes each worker's pair of accounts its own.
		const stamp = `${Date.now().toString().slice(-7)}${workerInfo.workerIndex.toString()}`;
		alice = await login(request, `+1888${stamp}1`, `Alice ${stamp}`);
		bob = await login(request, `+1888${stamp}2`, `Bob ${stamp}`);

		// Alice opens the thread, so both sides have it in their list.
		const created = await request.post(`${API}/conversations`, {
			headers: { authorization: `Bearer ${alice.token}` },
			data: { userId: bob.id },
		});
		expect(created.ok()).toBe(true);

		// One message so neither list is empty and both rows are findable.
		const conversationId = ((await created.json()) as { _id: string })._id;
		await request.post(`${API}/messages`, {
			headers: { authorization: `Bearer ${alice.token}` },
			data: { conversationId, text: 'opening the channel' },
		});
		await request.dispose();
	});

	const twoBrowsers = async (browser: Browser) => {
		const contextA = await browser.newContext();
		const contextB = await browser.newContext();
		const pageA = await contextA.newPage();
		const pageB = await contextB.newPage();
		await pageA.emulateMedia({ reducedMotion: 'reduce' });
		await pageB.emulateMedia({ reducedMotion: 'reduce' });
		return { contextA, contextB, pageA, pageB };
	};

	test("a message sent by one user appears in the other's open thread, with no refresh", async ({ browser }) => {
		const { contextA, contextB, pageA, pageB } = await twoBrowsers(browser);

		try {
			await signIn(pageA, alice);
			await signIn(pageB, bob);
			await openConversationWith(pageA, bob.name);
			await openConversationWith(pageB, alice.name);

			const text = `live ${Date.now().toString().slice(-6)}`;
			await composer(pageB).fill(text);
			await pageB.getByRole('button', { name: 'Send message' }).click();

			// Bob's own bubble is local echo, and proves nothing about delivery.
			await expect(pageB.getByRole('log').getByText(text)).toBeVisible();

			// Alice never reloaded. If this passes, the socket delivered it.
			await expect(pageA.getByRole('log').getByText(text)).toBeVisible({ timeout: 30_000 });
		} finally {
			await contextA.close();
			await contextB.close();
		}
	});

	test('an arrival for a conversation that is not open marks it unread instead', async ({ browser }) => {
		const { contextA, contextB, pageA, pageB } = await twoBrowsers(browser);

		try {
			await signIn(pageA, alice);
			await signIn(pageB, bob);

			// Alice stays on the list without opening anything.
			await pageA.goto('/chat');
			await expect(pageA.getByRole('button', { name: new RegExp(bob.name) }).first()).toBeVisible();

			await openConversationWith(pageB, alice.name);
			const text = `unread ${Date.now().toString().slice(-6)}`;
			await composer(pageB).fill(text);
			await pageB.getByRole('button', { name: 'Send message' }).click();

			// The row's preview updates and the count is announced in words, not
			// just as a coloured dot.
			await expect(pageA.getByText(/unread message/i).first()).toBeVisible({ timeout: 30_000 });
		} finally {
			await contextA.close();
			await contextB.close();
		}
	});
});
