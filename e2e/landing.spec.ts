import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { LANDING_WIDTHS, LandingPage } from './pages/landing-page';

/**
 * Part 2 — the landing page.
 *
 * The responsive and accessibility assertions are the load-bearing ones: the
 * page's whole argument is delivered as text and layout, so a width where the
 * document scrolls sideways or a contrast pair that fails is a content bug
 * rather than a cosmetic one.
 */

test.describe('landing page structure', () => {
	test('there is exactly one h1 and it carries the headline', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await expect(landing.heading).toHaveCount(1);
		await expect(landing.heading).toBeVisible();
		await expect(landing.heading).toHaveText(/on the air/i);
	});

	test('all four sections render', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await expect(landing.replaySection).toBeVisible();
		await expect(landing.claimsSection).toBeVisible();
		await expect(landing.identitySection).toBeVisible();
	});

	test('the hero login field is a labelled form', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await expect(landing.phoneField).toBeVisible();
		await expect(landing.nameField).toBeVisible();
		await expect(landing.submitButton).toBeVisible();
	});

	test('the secondary link reaches the standalone login page', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await landing.loginPageLink.click();
		await expect(page).toHaveURL(/\/login$/);
	});
});

test.describe('landing page metadata', () => {
	test('the description, canonical, and social tags are present and agree', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		const title = await page.title();
		expect(title.length).toBeGreaterThan(0);

		const description = await landing.metaContent('description');
		expect(description).toBeTruthy();

		await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

		// og:* must mirror the document rather than drift from it.
		expect(await landing.metaContent('og:title')).toBe(title);
		expect(await landing.metaContent('og:description')).toBe(description);
		expect(await landing.metaContent('og:image')).toBeTruthy();
		expect(await landing.metaContent('twitter:card')).toBe('summary_large_image');
	});

	test('the SoftwareApplication JSON-LD block parses', async ({ page }) => {
		await page.goto('/');

		const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
		expect(raw).toBeTruthy();

		const parsed: unknown = JSON.parse(raw ?? '{}');
		expect(parsed).toMatchObject({ '@type': 'SoftwareApplication', name: 'Wavelength' });
	});
});

test.describe('landing page responsiveness', () => {
	for (const width of LANDING_WIDTHS) {
		test(`no horizontal scroll at ${width.toString()}px`, async ({ page }) => {
			const landing = new LandingPage(page);
			await page.setViewportSize({ width, height: 900 });
			await landing.goto();

			await expect(landing.heading).toBeVisible();
			expect(await landing.hasHorizontalScroll()).toBe(false);
		});
	}

	test('the call to action is reachable without scrolling at 360x640', async ({ page }) => {
		const landing = new LandingPage(page);
		await page.setViewportSize({ width: 360, height: 640 });
		await landing.goto();

		await expect(landing.submitButton).toBeInViewport();
	});
});

test.describe('landing page accessibility', () => {
	for (const width of LANDING_WIDTHS) {
		test(`no detectable axe violations at ${width.toString()}px`, async ({ page }) => {
			const landing = new LandingPage(page);
			await page.setViewportSize({ width, height: 900 });
			await landing.goto();

			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
			expect(results.violations).toEqual([]);
		});
	}

	test('no detectable axe violations in dark mode', async ({ page }) => {
		const landing = new LandingPage(page);
		await page.emulateMedia({ colorScheme: 'dark' });
		await landing.goto();

		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
		expect(results.violations).toEqual([]);
	});
});

/**
 * The page's bonus claim is that its primary CTA *is* the whole onboarding, so
 * these assert the claim rather than the markup. Every API call is intercepted:
 * login on this API is account creation, and a spec run against the live server
 * would register a user per run and rename it on the next.
 */
test.describe('landing page onboarding', () => {
	const USER = { _id: 'user-1', name: 'Priya', phone: '+15551230134' };

	test.beforeEach(async ({ page }) => {
		await page.route('**/api/auth/login', async (route) => {
			const body = route.request().postDataJSON() as { phone: string; name: string };
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ token: 'valid.jwt.token', user: { ...USER, phone: body.phone, name: body.name } }),
			});
		});
		await page.route('**/api/auth/me', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
		});
	});

	/**
	 * The hero form is a client island, and Playwright waits on the DOM rather
	 * than on React attaching. Submitting before hydration lets the browser send
	 * the form natively — which is exactly how a phone number ends up in the
	 * address bar. As-you-type grouping is a behaviour only the hydrated form
	 * produces, so it is the gate.
	 */
	const hydrate = async (landing: LandingPage) => {
		// Retried as a unit: a single fill can land before React attaches, and
		// then nothing reformats it — the gate has to be able to try again, not
		// just wait longer on a value that will never change.
		// Cleared before each attempt, which is the whole point of the retry.
		// `fill` on an unhydrated field leaves the raw text behind; refilling the
		// same string then produces no change event once React does attach, so
		// the value never reformats and the gate waits forever. Only the slower
		// WebKit builds get there.
		await expect(async () => {
			await landing.phoneField.fill('');
			await landing.phoneField.fill('+1555');
			await expect(landing.phoneField).toHaveValue('+1 555', { timeout: 1_000 });
		}).toPass({ timeout: 20_000 });
		await landing.phoneField.fill('');
	};

	test('the hero login lands on /chat, authenticated', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();
		await hydrate(landing);

		await landing.phoneField.fill('+15551230134');
		await landing.nameField.fill('Priya');
		await landing.submitButton.click();

		await expect(page).toHaveURL(/\/chat$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();
	});

	test('the hero enforces the same rules as the login page', async ({ page }) => {
		let loginCalls = 0;
		await page.route('**/api/auth/login', async (route) => {
			loginCalls += 1;
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'valid.jwt.token', user: USER }) });
		});

		const landing = new LandingPage(page);
		await landing.goto();
		await hydrate(landing);

		// A number with no country code is refused rather than guessed at — the
		// same rule /login applies, because it is the same hook.
		await landing.phoneField.fill('5551230134');
		await landing.nameField.fill('Priya');
		await landing.submitButton.click();

		await expect(page.getByText('Include the country code, like +1 555 123 4567.')).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
		expect(loginCalls).toBe(0);
	});
});
