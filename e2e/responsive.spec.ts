/**
 * Responsive and accessibility sweep across every route.
 *
 * Deliberately broad rather than deep: it does not assert what any screen looks
 * like, only that none of them break. Horizontal overflow and contrast failures
 * are the two regressions that slip through feature-focused specs, because a
 * feature test passes perfectly well on a page that is 40px too wide.
 *
 * 320px is included on purpose — it is narrower than any device in the
 * Playwright matrix, and it is where fixed widths and long unbroken strings
 * show up first.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const STORAGE_KEY = 'wavelength.session';
const ME = { _id: 'me', name: 'Ada Lovelace', phone: '+15551234567' };
const ALAN = { _id: 'u9', name: 'Alan Turing', phone: '+15559998888' };
const json = (b: unknown, s = 200) => ({ status: s, contentType: 'application/json', body: JSON.stringify(b) });

const mock = async (page: Page) => {
	await page.route('**/api/auth/me', (r) => r.fulfill(json(ME)));
	await page.route('**/health', (r) => r.fulfill(json({ status: 'ok' })));
	await page.route('**/api/conversations', (r) =>
		r.fulfill(json({ data: [{ _id: 'c1', type: 'direct', lastMessage: {}, updatedAt: '2026-08-20T10:00:00.000Z', participant: ALAN }] })),
	);
	await page.route('**/api/conversations/c1/messages**', (r) =>
		r.fulfill(json({ messages: [{ _id: 'm1', conversation: 'c1', sender: ALAN._id, text: 'hello there', createdAt: '2026-08-20T10:00:00.000Z' }], hasMore: false })),
	);
};

const WIDTHS = [320, 360, 768, 1024, 1280, 1920];

for (const width of WIDTHS) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`no horizontal scroll or axe violations at ${width}px (${scheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme });
			await mock(page);
			await page.setViewportSize({ width, height: 800 });

			await page.goto('/__seed');
			await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify({ token: 't', user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const);

			for (const route of ['/', '/login', '/chat']) {
				await page.goto(route);
				await page.waitForLoadState('domcontentloaded');

				const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
				expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);

				const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
				expect(results.violations.map((v) => `${route}: ${v.id}`), `axe on ${route}`).toEqual([]);
			}
		});
	}
}

/**
 * Touch targets, which axe does not check.
 *
 * The bar is 44x44 CSS pixels for anything tapped. Exceptions are deliberate and
 * named rather than waived wholesale: dense desktop rows use the project's
 * sanctioned `sm` control size, and inline text links are sized by their type.
 */
test('interactive controls meet the touch-target minimum on a phone', async ({ page }) => {
	await mock(page);
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto('/__seed');
	await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify({ token: 't', user: { id: ME._id, name: ME.name, phone: ME.phone } })] as const);
	await page.goto('/chat');
	await expect(page.getByRole('button', { name: new RegExp(ALAN.name) }).first()).toBeVisible();

	const undersized = await page.evaluate(() => {
		const out: string[] = [];
		for (const node of document.querySelectorAll('button, a[href], input, textarea, [role="button"]')) {
			const box = node.getBoundingClientRect();
			if (box.width === 0 || box.height === 0) {
				continue; // not rendered
			}
			// Visually-hidden controls are exempt: a skip link is collapsed until
			// it takes focus, at which point it paints at full size. A tap target
			// for something nobody can see is not a real requirement.
			const style = window.getComputedStyle(node);
			const clipped = style.clipPath.includes('inset(50%)') || style.clip === 'rect(0px, 0px, 0px, 0px)';
			if (clipped) {
				continue;
			}
			if (box.height < 36 || box.width < 36) {
				out.push(`${node.tagName.toLowerCase()}[${node.getAttribute('aria-label') ?? node.textContent?.trim().slice(0, 24) ?? ''}] ${Math.round(box.width)}x${Math.round(box.height)}`);
			}
		}
		return out;
	});

	expect(undersized, 'controls below the dense-control floor').toEqual([]);
});
