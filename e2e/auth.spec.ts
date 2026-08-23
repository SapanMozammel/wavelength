import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Auth and session, end to end.
 *
 * Every request to the chat API is intercepted. Not for speed — for
 * determinism: the upstream server is a free Render instance that cold-starts
 * for 30-60 seconds (quirk 20), and login *is* account creation, so a spec run
 * against the live API would register a new user on every CI run and rename it
 * on the next. The shapes fulfilled below are the real wire shapes, `_id` and
 * all, so the normalizer is still exercised.
 *
 * The behaviour under test is the one the tri-state `session.status` exists to
 * protect: a signed-in user reloading `/chat` must never be shown `/login`,
 * not for a single frame, however long `/auth/me` takes to answer.
 */

const VALID_TOKEN = 'valid.jwt.token';
const EXPIRED_TOKEN = 'expired.jwt.token';
const STORAGE_KEY = 'wavelength.session';

const USER = { _id: 'user-1', name: 'Ada Lovelace', phone: '+15551234567' };

const storedSession = (token: string) => JSON.stringify({ token, user: { id: USER._id, name: USER.name, phone: USER.phone } });

/** Stands in for the whole auth surface: `/auth/login` and `/auth/me`. */
const mockAuthApi = async (page: Page) => {
	await page.route('**/api/auth/login', async (route) => {
		const body = route.request().postDataJSON() as { phone: string; name: string };
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ token: VALID_TOKEN, user: { ...USER, phone: body.phone, name: body.name } }),
		});
	});

	// `/chat` mounts the conversation directory the moment a session lands, so
	// the list has to be answered here too — an unmocked spec would reach the
	// shared upstream server and wait out its cold start.
	await page.route('**/api/conversations', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
	});

	await page.route('**/api/auth/me', async (route) => {
		const authorization = route.request().headers()['authorization'];
		if (authorization === `Bearer ${VALID_TOKEN}`) {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
			return;
		}
		// Quirk 5: an invalid token is a 401, a missing one is a 400. The client
		// keys on `error.code`, so both must be answered in the real envelope.
		await route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: { message: 'Invalid token', code: 'INVALID_TOKEN' } }),
		});
	});
};

/**
 * Seeds `localStorage` for the app's origin. Done by visiting the origin first
 * rather than with `addInitScript`, so the write happens once and the app is
 * free to clear the key without this putting it straight back.
 *
 * Seeded from a route that is neither under test nor expensive. `/login` is
 * out because Chromium can deliver that navigation's `framenavigated` event
 * after `goto` resolves, leaving a stray `/login` in a tracker armed next — a
 * correct app then reads as one that redirected. `/` is out because it is the
 * full landing page, and paying for its fonts and artwork on every seed makes
 * the redirect assertions time out under a saturated six-project matrix. The
 * 404 renders the same providers on a fraction of the work.
 */
const seedSession = async (page: Page, token: string) => {
	await page.goto('/__seed');
	await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [STORAGE_KEY, storedSession(token)] as const);
};

/**
 * Records every URL the page lands on, so a one-frame flash is still catchable.
 *
 * Only the two routes under test are recorded. The seeding navigation is not
 * one of them, and its event can arrive late enough to land in a tracker armed
 * after it — which would read as a redirect that never happened.
 */
const TRACKED_PATHS = new Set(['/login', '/chat']);

const trackNavigations = (page: Page): string[] => {
	const visited: string[] = [];
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame() && TRACKED_PATHS.has(new URL(frame.url()).pathname)) {
			visited.push(frame.url());
		}
	});
	return visited;
};

const phoneField = (page: Page) => page.getByLabel('Phone number');
const nameField = (page: Page) => page.getByLabel('Display name');
const submitButton = (page: Page) => page.getByRole('button', { name: 'Continue' });

/**
 * Opens `/login` and waits until the form is actually interactive.
 *
 * The form is a client island, and Playwright's auto-waiting covers the DOM,
 * not hydration. Clicking submit before React attaches lets the browser submit
 * the form natively — which navigates away instead of running client-side
 * validation, and puts the typed phone number in the URL on the way. On WebKit
 * under a loaded matrix that window is wide enough to lose a test to.
 *
 * The gate is a behaviour only the hydrated form produces: as-you-type
 * grouping. An unhydrated input holds whatever was typed, verbatim.
 */
const gotoLogin = async (page: Page) => {
	await page.goto('/login');
	// Retried as a unit: a single fill can land before React attaches, and then
	// nothing reformats it — the gate has to be able to try again, not just
	// wait longer on a value that will never change.
	// Cleared before each attempt, which is the whole point of the retry.
	// `fill` on an unhydrated field leaves the raw text behind; refilling the
	// same string then produces no change event once React does attach, so
	// the value never reformats and the gate waits forever. Only the slower
	// WebKit builds get there.
	await expect(async () => {
		await phoneField(page).fill('');
		await phoneField(page).fill('+1555');
		await expect(phoneField(page)).toHaveValue('+1 555', { timeout: 1_000 });
	}).toPass({ timeout: 20_000 });
	await phoneField(page).fill('');
};

test.beforeEach(async ({ page }) => {
	await mockAuthApi(page);
});

test.describe('logging in', () => {
	test('a phone number and a name are enough to reach the chat', async ({ page }) => {
		await gotoLogin(page);
		await expect(page.getByRole('heading', { level: 1, name: 'Tune in' })).toBeVisible();

		await phoneField(page).fill('+15551234567');
		await nameField(page).fill('Ada Lovelace');
		await submitButton(page).click();

		await expect(page).toHaveURL(/\/chat$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();
	});

	test('a number typed without a country code never reaches the network', async ({ page }) => {
		let loginCalls = 0;
		await page.route('**/api/auth/login', async (route) => {
			loginCalls += 1;
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: VALID_TOKEN, user: USER }) });
		});

		await gotoLogin(page);
		await phoneField(page).fill('5551234567');
		await nameField(page).fill('Ada Lovelace');
		await submitButton(page).click();

		await expect(page.getByText('Include the country code, like +1 555 123 4567.')).toBeVisible();
		await expect(page).toHaveURL(/\/login$/);
		expect(loginCalls).toBe(0);
	});

	test('an empty submit names both missing fields', async ({ page }) => {
		await gotoLogin(page);
		await submitButton(page).click();

		await expect(page.getByText('Enter your phone number.')).toBeVisible();
		await expect(page.getByText('Enter the name other people will see.')).toBeVisible();
	});

	test('the form is operable from the keyboard alone', async ({ page }) => {
		await gotoLogin(page);

		await phoneField(page).focus();
		await page.keyboard.type('+15551234567');
		await page.keyboard.press('Tab');
		await expect(nameField(page)).toBeFocused();
		await page.keyboard.type('Ada Lovelace');
		// Enter inside a text field submits the form — no reach for the mouse.
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(/\/chat$/);
	});

	test('the number is grouped as it is typed', async ({ page }) => {
		await page.goto('/login');
		await phoneField(page).pressSequentially('+15551234567');
		await expect(phoneField(page)).toHaveValue('+1 555 123 4567');
	});
});

test.describe('session restore', () => {
	test('reloading a signed-in chat never shows the login screen', async ({ page }) => {
		await seedSession(page, VALID_TOKEN);

		const visited = trackNavigations(page);
		await page.goto('/chat');

		await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();

		expect(visited.filter((url) => url.includes('/login'))).toEqual([]);
	});

	test('an expired token sends the user to login exactly once', async ({ page }) => {
		await seedSession(page, EXPIRED_TOKEN);

		const visited = trackNavigations(page);
		await page.goto('/chat');

		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Tune in' })).toBeVisible();

		// The guard moves the user once and leaves them there. A redirect wired
		// to every failing in-flight request instead of to the state transition
		// would show up as a bounce back to /chat after landing.
		//
		// Note this counts *arrivals*, not `framenavigated` events: Next's App
		// Router fires two of those for the initial /chat document (commit, then
		// hydration), so event-counting reads a correct single redirect as two.
		// What matters is that nothing navigates again once we reach /login.
		await page.waitForTimeout(500);
		const paths = visited.map((url) => new URL(url).pathname);
		const landed = paths.indexOf('/login');

		expect(paths.at(0)).toBe('/chat');
		expect(landed).toBeGreaterThan(-1);
		expect(paths.slice(landed)).toEqual(['/login']);

		// The dead token is not left on disk to be retried on the next boot.
		expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBeNull();
	});

	test('a signed-in visitor is moved off the login screen', async ({ page }) => {
		await seedSession(page, VALID_TOKEN);
		await page.goto('/login');

		await expect(page).toHaveURL(/\/chat$/);
	});

	test('the wait for /auth/me is narrated, not left silent', async ({ page }) => {
		await seedSession(page, VALID_TOKEN);
		// Hold the validation open so the `unknown` state is observable.
		await page.route('**/api/auth/me', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2_000));
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
		});

		await page.goto('/chat');

		const restoring = page.getByText('Restoring your session');
		await expect(restoring).toBeVisible();
		await expect(restoring).toHaveRole('status');
		await expect(page).toHaveURL(/\/chat$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();
	});
});

test.describe('accessibility', () => {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`/login has no detectable axe violations in ${colorScheme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await page.goto('/login');
			await expect(page.getByRole('heading', { level: 1, name: 'Tune in' })).toBeVisible();

			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
			expect(results.violations).toEqual([]);
		});
	}

	test('a field error is wired to its input, not merely coloured red', async ({ page }) => {
		await gotoLogin(page);
		await submitButton(page).click();

		await expect(phoneField(page)).toHaveAttribute('aria-invalid', 'true');
		await expect(phoneField(page)).toHaveAccessibleDescription(/enter your phone number/i);
	});
});
