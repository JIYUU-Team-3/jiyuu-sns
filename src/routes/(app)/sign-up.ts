import { expect, type Page } from '@playwright/test'

export async function sign_up(page: Page, handle: string) {
	const sign_up = await page.request.post('/api/auth/sign-up/email', {
		data: { email: `${handle}@example.test`, password: crypto.randomUUID(), name: handle },
	})
	expect(sign_up.ok()).toBe(true)
	await page.goto('/')
	await expect(page).toHaveURL(/\/onboarding$/)
	const field = page.getByLabel('Username')
	await expect(async () => {
		await field.fill(handle)
		await expect(field).toHaveValue(handle, { timeout: 1_000 })
	}).toPass()
	await page.getByRole('button', { name: 'Continue' }).click()
	await expect(page).toHaveURL(/\/$/)
	// Home must hydrate before tests click its tabs; a click before that does nothing.
	await page.waitForLoadState('networkidle')
}
