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
		await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`)
	}
})

test('a shared link is where a new account lands after login and onboarding @writes', async ({
	page,
}) => {
	const handle = `e2e_nx_${crypto.randomUUID().slice(0, 8)}`
	await page.goto('/search?q=hello')
	await expect(page).toHaveURL('/login?next=%2Fsearch%3Fq%3Dhello')
	await expect(page.locator('input[name="next"]')).toHaveValue('/search?q=hello')

	const sign_up = await page.request.post('/api/auth/sign-up/email', {
		headers: { origin: new URL(page.url()).origin },
		data: { email: `${handle}@example.test`, password: crypto.randomUUID(), name: handle },
	})
	expect(sign_up.ok()).toBe(true)
	await page.reload()
	await expect(page).toHaveURL('/onboarding?next=%2Fsearch%3Fq%3Dhello')
	const field = page.getByLabel('Username')
	await expect(async () => {
		await field.fill(handle)
		await expect(field).toHaveValue(handle, { timeout: 1_000 })
	}).toPass()
	await page.getByRole('button', { name: 'Continue' }).click()
	await expect(page).toHaveURL('/search?q=hello')

	await page.goto(`/login?next=${encodeURIComponent(`/u/${handle}`)}`)
	await expect(page).toHaveURL(`/u/${handle}`)
})
