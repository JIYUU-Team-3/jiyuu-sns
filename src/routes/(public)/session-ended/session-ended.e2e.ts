import { expect, test } from '@playwright/test'
import { sign_up } from '../../(app)/sign-up'

test('a sign-in that fails at Google lands on the session-ended page', async ({ page }) => {
	// What Google sends back after Cancel, here without a state Better Auth could recognise.
	await page.goto('/api/auth/callback/google?error=access_denied')
	await expect(page).toHaveURL(/\/session-ended\?error=/)
	await expect(page.getByRole('heading', { name: 'Your session has ended' })).toBeVisible()

	await page.getByRole('link', { name: 'Log in' }).click()
	await expect(page).toHaveURL(/\/login$/)
})

test('logging out asks first @writes', async ({ page }) => {
	const handle = `e2e_lo_${crypto.randomUUID().slice(0, 8)}`
	await sign_up(page, handle)

	await page.getByRole('button', { name: 'Account menu' }).click()
	await page.getByRole('menuitem', { name: `Log out @${handle}` }).click()
	const dialog = page.getByRole('dialog', { name: 'Are you sure?' })
	await dialog.getByRole('button', { name: 'Cancel' }).click()
	await expect(dialog).toBeHidden()
	await page.reload()
	await expect(page).toHaveURL(/\/$/)

	await page.getByRole('button', { name: 'Account menu' }).click()
	await page.getByRole('menuitem', { name: `Log out @${handle}` }).click()
	await dialog.getByRole('button', { name: `Log out @${handle}` }).click()
	await expect(page).toHaveURL(/\/login$/)
})
