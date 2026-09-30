import { expect, test } from '@playwright/test'
import { sign_up } from './sign-up'

/**
 * Posting happy path: sign up, pick a handle, then create, edit and delete a post.
 * Creates an account and posts in the database under test.
 */
test('create, edit and delete a post @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)

	// Email sign-up is enabled in Better Auth, which gives the test a session without Google.
	const sign_up = await page.request.post('/api/auth/sign-up/email', {
		data: { email: `e2e-${id}@example.test`, password: crypto.randomUUID(), name: 'E2E Tester' },
	})
	expect(sign_up.ok()).toBe(true)

	// No profile yet, so the app sends the new account to onboarding first.
	await page.goto('/')
	await expect(page).toHaveURL(/\/onboarding$/)
	await page.getByLabel('Username').fill(`e2e_${id}`)
	await page.getByRole('button', { name: 'Continue' }).click()
	await expect(page).toHaveURL(/\/$/)

	// Create from the inline composer on Home.
	const text = `Hello from e2e ${id}`
	const composer = page.locator('form.inline')
	// The button only disables itself once hydrated; before that the form posts without JS.
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.getByText('Your post was sent.')).toBeVisible()
	const card = page.locator('article.post', { hasText: text })
	await expect(card).toBeVisible()

	// Open it, then edit through the ⋯ menu.
	await card.locator('a[href*="/p/"]').click()
	await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/)
	const focus = page.locator('article.focus')
	await expect(focus).toContainText(text)
	await focus.getByRole('button', { name: 'More options' }).click()
	await page.getByRole('menuitem', { name: 'Edit post' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Post text').fill(`${text} (edited)`)
	await dialog.getByRole('button', { name: 'Save' }).click()
	await expect(focus).toContainText(`${text} (edited)`)
	await expect(focus).toContainText('Edited')

	// Delete with the confirm step; the post page sends us back Home.
	await focus.getByRole('button', { name: 'More options' }).click()
	await page.getByRole('menuitem', { name: 'Delete post' }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
	await expect(page).toHaveURL(/\/$/)
	await expect(page.getByText(text)).toHaveCount(0)
})

// A 2×1 PNG, so the upload has real image bytes and a known shape.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQv8BD/kD/YURmXYAAAAASUVORK5CYII=',
	'base64',
)

test('post photos with a hashtag, then a poll @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)
	await sign_up(page, `e2e_${id}`)
	const composer = page.locator('form.inline')
	const post_button = composer.getByRole('button', { name: 'Post', exact: true })

	// Two photos upload on pick; Post waits for both.
	await composer.getByLabel('Post text').fill(`Photos ${id} #e2e_${id}`)
	await composer.locator('input[type="file"]').setInputFiles([
		{ name: 'a.png', mimeType: 'image/png', buffer: PNG },
		{ name: 'b.png', mimeType: 'image/png', buffer: PNG },
	])
	await expect(composer.getByRole('button', { name: 'Remove' })).toHaveCount(2)
	await expect(post_button).toBeEnabled()
	await post_button.click()

	// The new post is pinned on top of the reloaded timeline, as a carousel.
	const card = page.locator('article.post', { hasText: `Photos ${id}` }).first()
	await expect(card.getByRole('group', { name: '2 photos' })).toBeVisible()
	await expect(card.getByRole('link', { name: `#e2e_${id}` })).toHaveAttribute(
		'href',
		`/search?q=%23e2e_${id}`,
	)

	// A poll needs a question and two choices; the author sees results straight away.
	await composer.getByLabel('Post text').fill(`Poll ${id}?`)
	await composer.getByRole('button', { name: 'Add poll' }).click()
	await expect(post_button).toBeDisabled()
	await composer.getByLabel('Choice 1', { exact: true }).fill('Tabs')
	await composer.getByLabel('Choice 2', { exact: true }).fill('Spaces')
	await post_button.click()
	const poll = page.locator('article.post', { hasText: `Poll ${id}?` }).first()
	await expect(poll).toContainText('Tabs')
	await expect(poll).toContainText('0 votes')
})
