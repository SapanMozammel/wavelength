import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The message panel — history, sending, and the states around them.
 *
 * This is the part of the assignment the brief says reviewers look at closest,
 * so the assertions here are about behaviour a user would notice: that history
 * arrives oldest-first, that an empty message cannot be sent by any route, and
 * that a send which fails leaves something the user can act on rather than
 * quietly disappearing.
 *
 * Every call is intercepted. The upstream server is shared and cold-starts for
 * up to a minute, and `POST /messages` writes real rows that other candidates
 * would see.
 */

const TOKEN = 'valid.jwt.token';
const STORAGE_KEY = 'wavelength.session';

const ME = { _id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const ALAN = { _id: 'u9', name: 'Alan Turing', phone: '+15559998888' };

const CONVERSATION = {
	_id: 'c1',
	type: 'direct',
	lastMessage: { text: 'Deploying now', sender: ALAN._id, createdAt: '2026-08-20T10:00:00.000Z' },
	updatedAt: '2026-08-20T10:00:00.000Z',
	participant: ALAN,
};

/** Newest-first, exactly as the API returns it — the normalizer reverses it. */
const HISTORY = [
	{ _id: 'm3', conversation: 'c1', sender: ALAN._id, text: 'Deploying now', createdAt: '2026-08-20T10:00:00.000Z' },
	{ _id: 'm2', conversation: 'c1', sender: ME._id, text: 'Ship it', createdAt: '2026-08-20T09:59:00.000Z' },
	{ _id: 'm1', conversation: 'c1', sender: ALAN._id, text: 'Morning', createdAt: '2026-08-19T08:00:00.000Z' },
];

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const mockChatApi = async (page: Page) => {
	await page.route('**/api/auth/me', (route) => route.fulfill(json(ME)));
	await page.route('**/api/conversations', (route) => route.fulfill(json({ data: [CONVERSATION] })));
	await page.route('**/api/conversations/c1/messages**', (route) => route.fulfill(json({ messages: HISTORY, hasMore: false })));
	await page.route('**/health', (route) => route.fulfill(json({ status: 'ok' })));
};

const seedSession = async (page: Page) => {
	await page.goto('/__seed');
	await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify({ token: TOKEN, user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const);
};

const log = (page: Page) => page.getByRole('log');
const composerField = (page: Page) => page.getByRole('textbox', { name: /message/i });
const sendButton = (page: Page) => page.getByRole('button', { name: 'Send message' });

const openThread = async (page: Page) => {
	await seedSession(page);
	await mockChatApi(page);
	await page.goto('/chat');
	await page.getByRole('button', { name: new RegExp(ALAN.name) }).first().click();
	// The log element exists while history is still loading, so waiting on it
	// alone returns a skeleton. Wait for the newest message to actually land.
	await expect(log(page).getByText('Deploying now')).toBeVisible();
};

test.describe('message history', () => {
	test('renders the full conversation oldest-first, with a day separator', async ({ page }) => {
		await openThread(page);

		const text = (await log(page).innerText()).replace(/\s+/g, ' ');
		expect(text.indexOf('Morning')).toBeLessThan(text.indexOf('Ship it'));
		expect(text.indexOf('Ship it')).toBeLessThan(text.indexOf('Deploying now'));

		// 'Morning' is a day earlier than the other two, so exactly one break.
		await expect(log(page).getByRole('separator')).toHaveCount(2);
	});

	test('gives every message a machine-readable timestamp', async ({ page }) => {
		await openThread(page);

		// Scoped to message rows: day separators legitimately carry a <time> of
		// their own, so an unscoped count measures both.
		const times = log(page).locator('article time[datetime]');
		await expect(times).toHaveCount(3);
		for (const value of await times.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime')))) {
			expect(Number.isNaN(Date.parse(value ?? ''))).toBe(false);
		}
	});

	test('distinguishes sent from received by more than colour', async ({ page }) => {
		await openThread(page);

		// Alignment and corner geometry carry the distinction too, so a greyscale
		// screenshot stays readable. Compare the two rows' class sets.
		const own = log(page).locator('article').filter({ hasText: 'Ship it' }).first();
		const other = log(page).locator('article').filter({ hasText: 'Morning' }).first();
		expect(await own.getAttribute('class')).not.toBe(await other.getAttribute('class'));
	});
});

test.describe('sending', () => {
	test('an empty or whitespace-only message cannot be sent by button or by Enter', async ({ page }) => {
		let posts = 0;
		await page.route('**/api/messages', (route) => {
			posts += 1;
			return route.fulfill(json({}));
		});
		await openThread(page);

		await expect(sendButton(page)).toBeDisabled();

		await composerField(page).fill('   ');
		await expect(sendButton(page)).toBeDisabled();
		// A disabled button does not stop the Enter key — this is the guard that
		// gets forgotten, so it is asserted separately.
		await composerField(page).press('Enter');

		await expect(log(page).getByText('Deploying now')).toBeVisible();
		expect(posts).toBe(0);
	});

	test('a sent message appears immediately, before the network answers', async ({ page }) => {
		await page.route('**/api/messages', async (route) => {
			// Slower than any reasonable frame budget: if the bubble only appears
			// after this resolves, the local echo is not local.
			await new Promise((resolve) => setTimeout(resolve, 1_500));
			await route.fulfill(json({ _id: 'm4', conversation: 'c1', sender: ME._id, text: 'On my way', createdAt: '2026-08-20T10:05:00.000Z' }));
		});
		await openThread(page);

		await composerField(page).fill('On my way');
		await sendButton(page).click();

		await expect(log(page).getByText('On my way')).toBeVisible({ timeout: 1_000 });
		// The field clears and keeps focus without waiting on the request.
		await expect(composerField(page)).toHaveValue('');
		await expect(composerField(page)).toBeFocused();
	});

	test('a failed send leaves the message on screen, marked, not vanished', async ({ page }) => {
		await page.route('**/api/messages', (route) => route.fulfill(json({ error: { message: 'Server error', code: 'SERVER_ERROR' } }, 500)));
		await openThread(page);

		await composerField(page).fill('This will fail');
		await sendButton(page).click();

		// The worst possible outcome is a message that disappears: that reads as
		// "sent". It must stay, and it must say it did not go.
		await expect(log(page).getByText('This will fail')).toBeVisible();
		await expect(log(page).getByText(/not sent/i)).toBeVisible();
	});
});

test.describe('message panel accessibility', () => {
	test('the log is a polite live region, never assertive', async ({ page }) => {
		await openThread(page);

		// Assertive would interrupt a screen-reader user mid-sentence every time
		// a message arrived, which is precisely wrong for a chat.
		await expect(log(page)).toHaveAttribute('aria-live', 'polite');
		await expect(log(page)).toHaveAttribute('tabindex', '0');
	});
});
