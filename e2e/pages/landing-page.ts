import type { Locator, Page } from '@playwright/test';

/** The widths the landing page is asserted against, smallest phone to desktop. */
export const LANDING_WIDTHS = [360, 768, 1280, 1920] as const;

/**
 * Page object for `/`. Specs address the page through these accessors rather
 * than raw selectors, so a markup change is a one-line fix here.
 */
export class LandingPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly openAppLink: Locator;
	readonly loginPageLink: Locator;
	readonly phoneField: Locator;
	readonly nameField: Locator;
	readonly submitButton: Locator;
	readonly replaySection: Locator;
	readonly claimsSection: Locator;
	readonly identitySection: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole('heading', { level: 1 });
		this.openAppLink = page.getByRole('link', { name: /open the app/i });
		this.loginPageLink = page.getByRole('link', { name: /use the login page/i });
		// Scoped to the textbox role, not getByLabel: the form carries an sr-only
		// legend naming both fields ("...with a phone number and a display name"),
		// so a loose label match resolves to the form as well as the input.
		this.phoneField = page.getByRole('textbox', { name: 'Phone number', exact: true });
		this.nameField = page.getByRole('textbox', { name: 'Display name', exact: true });
		this.submitButton = page.getByRole('button', { name: /go on the air/i });
		this.replaySection = page.locator('#replay');
		this.claimsSection = page.locator('#claims');
		this.identitySection = page.locator('#identity');
	}

	async goto() {
		await this.page.goto('/');
	}

	/** `content` of a `<meta>` tag, by `name` or by `property`. */
	async metaContent(key: string): Promise<string | null> {
		return this.page.locator(`meta[name="${key}"], meta[property="${key}"]`).first().getAttribute('content');
	}

	/** True when the document scrolls sideways at the current viewport width. */
	async hasHorizontalScroll(): Promise<boolean> {
		return this.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
	}
}
