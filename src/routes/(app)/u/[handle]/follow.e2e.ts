import { expect, test } from '@playwright/test'
import { sign_up } from '../../sign-up'

test('follow and unfollow is one-way @writes', async ({ page, browser }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_a_${id}`
	const bob = `e2e_b_${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	await sign_up(page, alice)

	await page.goto(`/u/${bob}`)
	// A click before hydration does nothing.
	await page.waitForLoadState('networkidle')
	const counts = page.locator('.counts')
	await expect(counts).toContainText('0 Followers')
	await page
		.locator('main')
		.getByRole('button', { name: `Follow @${bob}` })
		.click()
	await expect(page.locator('main').getByRole('button', { name: `Unfollow @${bob}` })).toBeVisible()
	await expect(counts).toContainText('1 Followers')

	await page.reload()
	await expect(counts).toContainText('1 Followers')
	await expect(counts).toContainText('0 Following')

	await page.goto(`/u/${alice}`)
	await expect(counts).toContainText('1 Following')
	await expect(counts).toContainText('0 Followers')
	// The counts are buttons too ("1 Following"), so match the follow button's own label, and
	// stay in the main column: the rail suggests people to follow.
	await expect(
		page.locator('main').getByRole('button', { name: /^(Follow|Unfollow) @/ }),
	).toHaveCount(0)

	await bob_page.goto(`/u/${alice}`)
	await expect(bob_page.getByText('Follows you')).toBeVisible()
	await expect(
		bob_page.locator('main').getByRole('button', { name: `Follow @${alice}` }),
	).toHaveText('Follow back')

	await page.goto(`/u/${bob}`)
	// A click before hydration does nothing.
	await page.waitForLoadState('networkidle')
	await page
		.locator('main')
		.getByRole('button', { name: `Unfollow @${bob}` })
		.click()
	await expect(page.locator('main').getByRole('button', { name: `Follow @${bob}` })).toBeVisible()
	await expect(counts).toContainText('0 Followers')

	await bob_context.close()
})
