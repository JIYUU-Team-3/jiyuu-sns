import { expect, type Page } from '@playwright/test'

/** Follow `handle` from its profile, waiting until the server has it. */
export async function follow(page: Page, handle: string) {
	await page.goto(`/u/${handle}`)
	await page.waitForLoadState('networkidle')
	const saved = page.waitForResponse((response) => response.url().includes('/set_follow'))
	await page
		.getByRole('main')
		.getByRole('button', { name: `Follow @${handle}` })
		.click()
	expect((await saved).ok()).toBe(true)
}
