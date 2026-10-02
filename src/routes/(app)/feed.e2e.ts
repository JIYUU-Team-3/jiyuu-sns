import { expect, test } from '@playwright/test'
import { sign_up } from './sign-up'

test('following someone brings their posts into the Following feed @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_fa_${id}`
	const bob = `e2e_fb_${id}`
	const text = `Feed post from ${bob}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	const composer = bob_page.locator('form.inline')
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(bob_page.getByText('Your post was sent.')).toBeVisible()
	await bob_context.close()

	await sign_up(page, alice)
	const following_tab = page.getByRole('tab', { name: 'Following' })
	await following_tab.click()
	await expect(page.getByText('Your timeline is quiet')).toBeVisible()
	await page.getByRole('button', { name: 'Find people to follow' }).click()
	await expect(page.getByRole('tab', { name: 'For you' })).toHaveAttribute('aria-selected', 'true')
	await expect(page.locator('article.post', { hasText: text })).toBeVisible()

	await page.goto(`/u/${bob}`)
	// A click before hydration does nothing.
	await page.waitForLoadState('networkidle')
	await page
		.locator('main')
		.getByRole('button', { name: `Follow @${bob}` })
		.click()
	await expect(page.locator('main').getByRole('button', { name: `Unfollow @${bob}` })).toBeVisible()

	await page.goto('/')
	await page.waitForLoadState('networkidle')
	await following_tab.click()
	await expect(page.locator('article.post', { hasText: text })).toBeVisible()

	await page.goto(`/u/${bob}`)
	// A click before hydration does nothing.
	await page.waitForLoadState('networkidle')
	await page
		.locator('main')
		.getByRole('button', { name: `Unfollow @${bob}` })
		.click()
	await expect(page.locator('main').getByRole('button', { name: `Follow @${bob}` })).toBeVisible()

	await page.goto('/')
	await page.waitForLoadState('networkidle')
	await following_tab.click()
	await expect(page.getByText('Your timeline is quiet')).toBeVisible()
})

test('a post made while Home is open is offered by the posted pill @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const text = `Pill post ${id}`

	await sign_up(page, `e2e_pa_${id}`)
	const pill = page.getByRole('button', { name: 'posted' })
	await expect(pill).toBeHidden()

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, `e2e_pb_${id}`)
	const composer = bob_page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(bob_page.getByText('Your post was sent.')).toBeVisible()
	await bob_context.close()

	await expect(page.locator('article.post', { hasText: text })).toBeHidden()
	// Home checks every ten seconds.
	await expect(pill).toBeVisible({ timeout: 20_000 })
	await pill.click()
	await expect(page.locator('article.post', { hasText: text })).toBeVisible()
	await expect(pill).toBeHidden()
})
