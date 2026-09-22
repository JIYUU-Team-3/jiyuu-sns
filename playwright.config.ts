import { defineConfig, devices } from '@playwright/test'

/**
 * Where the tests point.
 *
 * - Unset (local dev and PR CI): a production build is served by
 *   `pnpm preview:ci`, which runs wrangler with `--local` so D1 is emulated
 *   and no Cloudflare credentials are needed.
 * - Set (post-deploy verification): the tests hit that URL directly and no
 *   local server is started.
 */
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4173'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	/* E2E specs live next to the routes they cover, e.g. src/routes/demo/playwright/page.svelte.e2e.ts. */
	testDir: './src',
	testMatch: '**/*.e2e.{ts,js}',
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('')`. */
		baseURL,

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',

		/* Run headless everywhere; this is already Playwright's default, made explicit so CI's mode isn't implicit. */
		headless: true,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},

		/* Test against mobile viewports. */
		// {
		//   name: 'Mobile Chrome',
		//   use: { ...devices['Pixel 5'] },
		// },
		// {
		//   name: 'Mobile Safari',
		//   use: { ...devices['iPhone 12'] },
		// },

		/* Test against branded browsers. */
		// {
		//   name: 'Microsoft Edge',
		//   use: { ...devices['Desktop Edge'], channel: 'msedge' },
		// },
		// {
		//   name: 'Google Chrome',
		//   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
		// },
	],

	/*
	 * Serve the built app, unless we were pointed at an already-deployed URL.
	 *
	 * `preview:ci` runs wrangler with `--local`, so D1 is the emulated database
	 * under .wrangler/state. It starts empty, and src/hooks.server.ts queries
	 * the auth tables on every request, so create them first with
	 * `pnpm db:migrate:local`.
	 */
	webServer: externalBaseURL
		? undefined
		: {
				command: 'pnpm run preview:ci',
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
})
