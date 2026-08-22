import { defineConfig, devices } from '@playwright/test';

// A dedicated port so a running `pnpm dev` is never disturbed by a test run,
// and overridable so neither is a hard dependency.
const PORT = Number(process.env.E2E_PORT ?? 8001);
const BASE_URL = `http://localhost:${PORT}`;

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
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'firefox-desktop',
			use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'webkit-desktop',
			use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 }, locale: 'en-US' },
		},
		{
			name: 'mobile-chromium',
			use: { ...devices['Pixel 7'] },
		},
		{
			name: 'mobile-webkit',
			use: { ...devices['iPhone 15'] },
		},
		{
			name: 'dark-mode',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, locale: 'en-US', colorScheme: 'dark' },
		},
	],
});

export default config;
