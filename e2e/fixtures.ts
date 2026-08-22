import { test as base, expect } from '@playwright/test';

/**
 * The project's default test fixtures.
 *
 * Every spec imports `test` and `expect` from here, never from
 * `@playwright/test` directly — see `.claude/skills/workflow/e2e.md`.
 *
 * The `page` fixture forces `prefers-reduced-motion: reduce`. This is not a
 * convenience: the landing page's entrance animations run for up to 980ms with
 * `animation-fill-mode: both`, so an element is genuinely at `opacity: 0` for
 * most of a second after load. An axe scan landing in that window reports the
 * whole page as a contrast failure — fifty-odd nodes at a 1.01 ratio, because
 * it is measuring nearly-invisible text — and it does so only when the machine
 * is loaded enough to shift the timing. Reduced motion collapses the animation
 * so content is simply present, which is what every assertion here means to
 * measure.
 *
 * Motion itself is verified separately, under a project that does not emulate
 * this. Do not disable it inside an ordinary spec.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await use(page);
	},
});

export { expect };
