import { expect, type Page, test } from '@playwright/test'
import { sign_up } from '../sign-up'

async function post(page: Page, text: string) {
	await page.goto('/')
	const composer = page.locator('form.inline')
	// The button only disables itself once hydrated; before that the form posts without JS.
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.getByText('Your post was sent.')).toBeVisible()
}

test('mentions, likes and follows notify, and opening the list clears the badge @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_a_${id}`
	const bob = `e2e_b_${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	await sign_up(page, alice)

	// Alice mentions Bob; Bob follows Alice and likes her post.
	const text = `Hi @${bob}, welcome ${id}`
	await post(page, text)

	await bob_page.goto(`/u/${alice}`)
	// A click before hydration does nothing, so wait for the page to settle first.
	await bob_page.waitForLoadState('networkidle')
	await bob_page.getByRole('button', { name: `Follow @${alice}` }).click()
	await expect(bob_page.getByRole('button', { name: `Unfollow @${alice}` })).toBeVisible()
	const card = bob_page.locator('article.post', { hasText: text })
	await card.getByRole('button', { name: 'Like' }).click()
	await expect(card.getByRole('button', { name: 'Liked, 1' })).toBeVisible()

	// Bob hears about the mention.
	await bob_page.goto('/notifications')
	await expect(bob_page.locator('article.post', { hasText: text })).toBeVisible()

	// Alice sees two unread (the follow and the like) until she opens the list.
	await page.goto('/')
	const nav = page.locator('nav.side')
	await expect(nav.getByRole('link', { name: /Notifications.*2 unread/ })).toBeVisible()
	await nav.getByRole('link', { name: /Notifications/ }).click()
	await expect(page).toHaveURL(/\/notifications$/)
	await expect(page.getByText(`${bob} liked your post`)).toBeVisible()
	await expect(page.getByText(`${bob} followed you`)).toBeVisible()
	await expect(nav.getByRole('link', { name: /unread/ })).toHaveCount(0)

	// Unliking takes the like notification back.
	await bob_page.goto(`/u/${alice}`)
	await bob_page.waitForLoadState('networkidle')
	await bob_page
		.locator('article.post', { hasText: text })
		.getByRole('button', { name: 'Liked, 1' })
		.click()
	await expect(
		bob_page.locator('article.post', { hasText: text }).getByRole('button', { name: 'Like' }),
	).toBeVisible()
	// The button flips before the server answers, so allow a reload or two.
	await expect(async () => {
		await page.reload()
		await expect(page.getByText(`${bob} followed you`)).toBeVisible()
		await expect(page.getByText(`${bob} liked your post`)).toHaveCount(0, { timeout: 1_000 })
	}).toPass()

	// Editing the mention out takes Bob's mention notification back.
	await page.goto(`/u/${alice}`)
	await page.waitForLoadState('networkidle')
	const own = page.locator('article.post', { hasText: text })
	await own.getByRole('button', { name: 'More options' }).click()
	await page.getByRole('menuitem', { name: 'Edit post' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Post text').fill(`Hi everyone, welcome ${id}`)
	await dialog.getByRole('button', { name: 'Save' }).click()
	await expect(page.getByText('Post updated')).toBeVisible()
	await bob_page.goto('/notifications')
	// It was Bob's only notification, so his list is empty again.
	await expect(bob_page.getByText('Nothing to see here yet')).toBeVisible()
	await expect(bob_page.getByText(`welcome ${id}`)).toHaveCount(0)

	await bob_context.close()
})
