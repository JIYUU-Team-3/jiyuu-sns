import { expect, test } from '@playwright/test'
import { sign_up } from '../sign-up'

test('settings opens from the account menu and keeps the chosen theme @writes', async ({
	page,
}) => {
	await sign_up(page, `e2e_set_${crypto.randomUUID().slice(0, 8)}`)

	await page.getByRole('button', { name: 'Account menu' }).first().click()
	await page.getByRole('menuitem', { name: 'Settings' }).click()
	await expect(page).toHaveURL(/\/settings$/)
	await expect(page.getByRole('heading', { name: 'Display' })).toBeVisible()
	await page.waitForLoadState('networkidle')
	await expect(page.getByRole('switch', { name: /Transparent background/ })).toBeVisible()

	const html = page.locator('html')
	await page.getByRole('radio', { name: 'Dark', exact: true }).check({ force: true })
	await expect(html).toHaveAttribute('data-theme', 'dark')
	await page.getByRole('radio', { name: 'Green' }).check({ force: true })
	await expect(html).toHaveAttribute('data-accent', 'green')

	// The server paints the saved choice into the first HTML, and the picker shows it.
	await page.reload()
	await expect(html).toHaveAttribute('data-theme', 'dark')
	await expect(html).toHaveAttribute('data-accent', 'green')
	await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()

	await page.getByRole('radio', { name: 'Daylight' }).check({ force: true })
	await expect(html).toHaveAttribute('data-theme', 'daylight')
	await expect(html).toHaveAttribute('style', /--bg:/)
	await page.getByRole('radio', { name: 'System' }).check({ force: true })
	await expect(html).not.toHaveAttribute('data-theme')
	await expect(html).not.toHaveAttribute('style', /--bg:/)
})

test('language can be switched from settings on a phone @writes', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await sign_up(page, `e2e_lng_${crypto.randomUUID().slice(0, 8)}`)

	await page.goto('/settings')
	await page.waitForLoadState('networkidle')
	// Transparent mode is desktop only, so a phone never renders it.
	await expect(page.getByRole('switch', { name: /Transparent background/ })).toBeHidden()
	await page.getByRole('radio', { name: '日本語' }).check({ force: true })
	await expect(page).toHaveURL(/\/ja\/settings$/)
	await expect(page.getByRole('heading', { name: '表示' })).toBeVisible()
})

test('going back after switching language skips the old page and keeps the new language @writes', async ({
	page,
}) => {
	await sign_up(page, `e2e_lbk_${crypto.randomUUID().slice(0, 8)}`)
	// Reloaded, so going back to the feed isn't served sign-up's redirect to onboarding.
	await page.goto('/')
	await page.goto('/settings')
	await page.waitForLoadState('networkidle')
	await page.getByRole('radio', { name: '日本語' }).check({ force: true })
	await expect(page).toHaveURL(/\/ja\/settings$/)

	// The feed was opened in English, and comes back in Japanese.
	await page.getByRole('button', { name: '戻る', exact: true }).click()
	await expect(page).toHaveURL(/\/ja\/?$/)
	await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()

	// A link in another language opens in the chosen one.
	await page.goto('/settings')
	await expect(page).toHaveURL(/\/ja\/settings$/)
})

test('opening a link in another language does not change the language of later pages', async ({
	page,
}) => {
	await page.goto('/ja/login')
	await page.waitForLoadState('networkidle')
	await page.goto('/login')
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
