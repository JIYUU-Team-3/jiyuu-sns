import { expect, test } from '@playwright/test'

test('a signed-out visitor lands on the login page, with the security headers', async ({
	page,
}) => {
	const response = await page.goto('/')
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()

	const headers = response!.headers()
	expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
	expect(headers['x-frame-options']).toBe('DENY')
	expect(headers['x-content-type-options']).toBe('nosniff')
})

test('posts, profiles and search are closed to signed-out visitors', async ({ page }) => {
	for (const path of ['/u/someone', '/p/00000000-0000-4000-8000-000000000000', '/search?q=a']) {
		await page.goto(path)
		await expect(page).toHaveURL(/\/login$/)
	}
})
