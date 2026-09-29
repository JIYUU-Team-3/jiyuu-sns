import { expect, test } from '@playwright/test'

/**
 * Profile happy path: a new account opens its own profile from the nav, sees its details
 * and posts, then edits it. Creates an account and a post in the database under test.
 */
test('shows and edits your profile @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const handle = `e2e_${id}`

	const sign_up = await page.request.post('/api/auth/sign-up/email', {
		data: { email: `e2e-${id}@example.test`, password: crypto.randomUUID(), name: 'E2E Tester' },
	})
	expect(sign_up.ok()).toBe(true)

	await page.goto('/onboarding')
	await page.getByLabel('Username').fill(handle)
	await page.getByRole('button', { name: 'Continue' }).click()
	await expect(page).toHaveURL(/\/$/)

	const text = `Profile post ${id}`
	const composer = page.locator('form.inline')
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.getByText('Your post was sent.')).toBeVisible()

	await page.getByRole('navigation').getByRole('link', { name: 'Profile' }).first().click()
	await expect(page).toHaveURL(new RegExp(`/u/${handle}$`))
	await expect(page.getByRole('heading', { name: 'E2E Tester', level: 2 })).toBeVisible()
	await expect(page.locator('section.top .handle')).toHaveText(`@${handle}`)
	await expect(page.getByText(/^Joined \w+ \d{4}$/)).toBeVisible()
	// Scoped to the main column: trending tags in the rail show post counts too.
	await expect(page.locator('main').getByText('1 post', { exact: true })).toBeVisible()
	await expect(page.locator('article.post', { hasText: text })).toBeVisible()

	// Replies has its own list, empty for a new account.
	await page.getByRole('tab', { name: 'Replies' }).click()
	await expect(page.getByText('No replies yet')).toBeVisible()

	// Edit profile saves and comes back to the profile.
	await page.getByRole('link', { name: 'Edit profile' }).click()
	await expect(page).toHaveURL(/\/settings\/profile$/)
	await page.getByLabel('Display name').fill('E2E Edited')
	await page.getByLabel('Bio (optional)').fill(`Bio ${id}`)
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${handle}$`))
	await expect(page.getByRole('heading', { name: 'E2E Edited', level: 2 })).toBeVisible()
	await expect(page.getByText(`Bio ${id}`)).toBeVisible()

	const missing = await page.goto('/u/no_such_user_here')
	expect(missing?.status()).toBe(404)
})
