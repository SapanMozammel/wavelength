import type { Locator, Page } from '@playwright/test';

/**
 * Page object for `/`. Specs address the page through these accessors rather
 * than raw selectors, so a markup change is a one-line fix here.
 */
export class LandingPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly openAppLink: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole('heading', { level: 1 });
		this.openAppLink = page.getByRole('link', { name: /open the app/i });
	}

	async goto() {
		await this.page.goto('/');
	}
}
