import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Cold-start narration.
 *
 * The demo API is a free Render instance that sleeps after inactivity (quirk
 * 20), so the first request of a session can take 30 to 60 seconds. That is not
 * reproducible on demand — by the time anyone runs this, the server may well be
 * warm — so both halves of the behaviour are driven by intercepting `/health`
 * at the origin root and controlling the clock ourselves.
 *
 * The **second** test is the important one. Narration that shows on every load
 * is not a feature, it is a permanent banner nobody reads, and it would make
 * the one moment this exists for invisible. Proving silence is harder and
 * matters more than proving speech.
 *
 * Copy assertions here are loose on purpose: `wakeCopyFor` in
 * `src/hooks/use-api-wake.ts` owns the exact strings and is asserted verbatim
 * in `tests/hooks/use-api-wake.test.ts`. What this spec pins is that the
 * *cause* is named on screen, not that a particular sentence was chosen.
 */

/** The probe deliberately hits the ORIGIN ROOT, never `/api/health` — which 404s. */
const HEALTH = '**/health';

/** Answers `/health` after `delayMs`, the way a sleeping instance does. */
const mockHealth = async (page: Page, delayMs: number) => {
	await page.route(HEALTH, async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
	});
};

test.describe('a sleeping server explains itself', () => {
	test('narrates the wait, names the cause, and acknowledges the wake', async ({ page }) => {
		await mockHealth(page, 12_000);
		await page.goto('/login');

		const notice = page.getByRole('status');

		// Nothing at all before the 2.5s threshold.
		await expect(notice).toBeHidden();

		// It arrives, and it says *what is happening*, not "loading".
		await expect(notice).toBeVisible({ timeout: 8_000 });
		await expect(notice).toContainText(/waking the demo server/i);

		// And it escalates rather than repeating one string for twelve seconds.
		await expect(notice).toContainText(/cold start/i, { timeout: 10_000 });

		// The loop closes: the wake is acknowledged, then the notice leaves.
		await expect(notice).toContainText(/awake/i, { timeout: 10_000 });
		await expect(notice).toBeHidden({ timeout: 10_000 });
	});

	test('offers a working retry when nothing answers at all', async ({ page }) => {
		await page.route(HEALTH, (route) => route.abort('connectionrefused'));
		await page.goto('/login');

		// The full budget is 60s; the spec timeout is 90s, so this is the one
		// test here that genuinely waits it out rather than faking it.
		const alert = page.getByRole('alert');
		await expect(alert).toContainText(/isn’t responding/i, { timeout: 70_000 });

		const retry = alert.getByRole('button', { name: /retry/i });
		await expect(retry).toBeVisible();

		// A retry that re-probes: unroute first, so the second attempt succeeds
		// and the alert clears — proof the button is wired to the probe and not
		// merely to dismissing itself.
		await page.unroute(HEALTH);
		await mockHealth(page, 0);
		await retry.click();
		await expect(alert).toBeHidden({ timeout: 15_000 });
	});
});

test.describe('a warm server says nothing', () => {
	test('never narrates when the probe answers immediately', async ({ page }) => {
		await mockHealth(page, 0);
		await page.goto('/login');

		// The login form is fully interactive — the app was never gated.
		await expect(page.getByRole('button', { name: /continue/i })).toBeEnabled();

		// Well past the 2.5s threshold and the acknowledgement window, there is
		// still nothing: no narration, and no "Server's awake" either, because
		// no wait was ever announced.
		await page.waitForTimeout(6_000);
		await expect(page.getByRole('status')).toBeHidden();
		await expect(page.getByRole('alert')).toBeHidden();
		await expect(page.getByText(/waking the demo server/i)).toBeHidden();
		await expect(page.getByText(/awake/i)).toBeHidden();
	});
});
