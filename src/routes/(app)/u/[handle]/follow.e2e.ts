import { expect, test } from '@playwright/test'
import { follow } from '../../follow'
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
	// Match the follow button's own label, and stay in the main column: the rail suggests people
	// to follow.
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

test('the follow lists show who follows whom, and a follower can be removed @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_la_${id}`
	const bob = `e2e_lb_${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	await sign_up(page, alice)
	await follow(page, bob)

	await page.goto(`/u/${alice}`)
	await page.waitForLoadState('networkidle')
	await page.locator('.counts').getByRole('link', { name: '1 Following' }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${alice}/following$`))
	const rows = page.locator('main .urow')
	await expect(rows).toHaveCount(1)
	await expect(rows).toContainText(`@${bob}`)
	await page.getByRole('link', { name: 'Followers', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${alice}/followers$`))
	await expect(page.getByText('No followers yet')).toBeVisible()

	await bob_page.goto(`/u/${bob}/followers`)
	await bob_page.waitForLoadState('networkidle')
	const row = bob_page.locator('main .urow', { hasText: `@${alice}` })
	// Everyone on your own followers list follows you, so the pill would only repeat it.
	await expect(row.getByRole('button', { name: `Follow @${alice}` })).toBeVisible()
	await expect(row.getByText('Follows you')).toHaveCount(0)
	await expect(row.getByRole('button', { name: `Follow @${alice}` })).toHaveText('Follow back')

	await row.getByRole('button', { name: `More for @${alice}` }).click()
	await bob_page.getByRole('menuitem', { name: 'Remove this follower' }).click()
	const removed = bob_page.waitForResponse((response) =>
		response.url().includes('/remove_follower'),
	)
	await bob_page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
	expect((await removed).ok()).toBe(true)
	await expect(row).toHaveCount(0)

	await bob_page.goto(`/u/${bob}`)
	await expect(bob_page.locator('.counts')).toContainText('0 Followers')
	await page.goto(`/u/${bob}`)
	await expect(page.locator('main').getByRole('button', { name: `Follow @${bob}` })).toBeVisible()

	await bob_context.close()
})
