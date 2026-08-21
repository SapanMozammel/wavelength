import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { LandingPage } from './pages/landing-page';

/**
 * Infrastructure smoke test. Deliberately asserts only what is true of the
 * scaffold — routes resolve, the theme tokens are applied, and the pages are
 * accessible. Feature coverage arrives with the features, per the PRDs.
 */

test.describe('routing', () => {
	test('the landing page renders and links into the app', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await expect(landing.heading).toBeVisible();
		await landing.openAppLink.click();

		// `/chat` is guarded client-side (there is no server session for
		// middleware to read), so an unauthenticated visitor is moved to the
		// login screen rather than shown an empty chat.
		await expect(page).toHaveURL(/\/login$/);
	});

	test('login and chat routes resolve', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

		await page.goto('/chat');
		await expect(page).toHaveURL(/\/login$/);
	});

	test('an unknown route renders the 404 page', async ({ page }) => {
		await page.goto('/no-such-page');
		await expect(page.getByRole('heading', { name: /signal lost/i })).toBeVisible();
	});
});

test.describe('accessibility', () => {
	for (const path of ['/', '/login', '/chat']) {
		test(`${path} has no detectable axe violations`, async ({ page }) => {
			await page.goto(path);
			// `/chat` resolves to the login screen while signed out; either way,
			// wait for a settled render before scanning.
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
			expect(results.violations).toEqual([]);
		});
	}
});

test.describe('theming', () => {
	test('the body paints a token background in dark mode', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(background).not.toBe('rgba(0, 0, 0, 0)');
	});
});
