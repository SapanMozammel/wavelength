import { defineConfig, devices } from '@playwright/test';

// A dedicated port so a running `pnpm dev` is never disturbed by a test run,
// and overridable so neither is a hard dependency.
const PORT = Number(process.env.E2E_PORT ?? 8001);
const BASE_URL = `http://localhost:${PORT}`;

	// `realtime.spec.ts` talks to the live API and registers real accounts. What
	// it proves — the server's socket fan-out — is identical in every browser, so
	// it runs on one project only. Running it across the matrix would buy no
	// extra signal and would leave a dozen throwaway users and conversations per
	// run on a server other people are sharing.
	const LIVE_API_SPEC = /realtime\.spec\.ts/;

	// ...and it is skipped entirely in CI. It registers real accounts on a shared
	// demo server that cold-starts for up to a minute, so on every push it would
	// be both a flake source and litter in someone else's data. It stays a local
	// proof, run deliberately.
	const CHROMIUM_IGNORES = process.env.CI === undefined ? [] : [LIVE_API_SPEC];

const config = defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 2,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
	timeout: 90_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	webServer: {
		command: `pnpm next dev --port=${PORT} --turbo`,
		url: BASE_URL,
		timeout: 180_000,
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
	},
	projects: [
		{
			name: 'chromium-desktop',
			testIgnore: CHROMIUM_IGNORES,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'firefox-desktop',
			testIgnore: LIVE_API_SPEC,
			use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'webkit-desktop',
			testIgnore: LIVE_API_SPEC,
			use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'mobile-chromium',
			testIgnore: LIVE_API_SPEC,
			use: { ...devices['Pixel 7'] },
		},
		{
			name: 'mobile-webkit',
			testIgnore: LIVE_API_SPEC,
			use: { ...devices['iPhone 15'] },
		},
		{
			name: 'dark-mode',
			testIgnore: LIVE_API_SPEC,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'dark' },
		},
	],
});

export default config;
