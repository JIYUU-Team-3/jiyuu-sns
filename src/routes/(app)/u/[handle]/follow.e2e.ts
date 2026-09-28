import { expect, test, type Page } from '@playwright/test'

async function sign_up(page: Page, handle: string) {
	const sign_up = await page.request.post('/api/auth/sign-up/email', {
		data: { email: `${handle}@example.test`, password: crypto.randomUUID(), name: handle },
	})
	expect(sign_up.ok()).toBe(true)
	await page.goto('/')
	await expect(page).toHaveURL(/\/onboarding$/)
	await page.getByLabel('Username').fill(handle)
	await page.getByRole('button', { name: 'Continue' }).click()
	await expect(page).toHaveURL(/\/$/)
}

test('follow and unfollow is one-way @writes', async ({ page, browser }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_a_${id}`
	const bob = `e2e_b_${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	await sign_up(page, alice)

	await page.goto(`/u/${bob}`)
	const counts = page.locator('.counts')
	await expect(counts).toContainText('0 Followers')
	await page.getByRole('button', { name: `Follow @${bob}` }).click()
	await expect(page.getByRole('button', { name: `Unfollow @${bob}` })).toBeVisible()
	await expect(counts).toContainText('1 Followers')

	await page.reload()
	await expect(counts).toContainText('1 Followers')
	await expect(counts).toContainText('0 Following')

	await page.goto(`/u/${alice}`)
	await expect(counts).toContainText('1 Following')
	await expect(counts).toContainText('0 Followers')
	await expect(page.getByRole('button', { name: /Follow/ })).toHaveCount(0)

	await bob_page.goto(`/u/${alice}`)
	await expect(bob_page.getByText('Follows you')).toBeVisible()
	await expect(bob_page.getByRole('button', { name: `Follow @${alice}` })).toHaveText('Follow back')

	await page.goto(`/u/${bob}`)
	await page.getByRole('button', { name: `Unfollow @${bob}` }).click()
	await expect(page.getByRole('button', { name: `Follow @${bob}` })).toBeVisible()
	await expect(counts).toContainText('0 Followers')

	await bob_context.close()
})
