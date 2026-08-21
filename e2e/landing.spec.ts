import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
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

test.describe('landing page onboarding', () => {
	// Blocked on `.claude/plans/03-auth-session`: the hero field is a
	// presentational shell until `use-login-form` exists, so submitting it
	// deliberately does nothing. Unskip together with the wiring.
	test.fixme('the hero login lands on /chat, authenticated', async ({ page }) => {
		const landing = new LandingPage(page);
		await landing.goto();

		await landing.phoneField.fill('+15550134');
		await landing.nameField.fill('Priya');
		await landing.submitButton.click();

		await expect(page).toHaveURL(/\/chat$/);
	});
});
