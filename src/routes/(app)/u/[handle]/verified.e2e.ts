import { expect, test } from '@playwright/test'
import { grant_verified } from '../../mod/local-db'
import { sign_up } from '../../sign-up'

test('a verified developer has the check beside their name, and nobody else does @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const dev = `e2e_vd_${id}`
	const text = `Verified post ${id}`
	await sign_up(page, dev)
	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.getByText('Your post was sent.')).toBeVisible()
	const check = page.getByRole('img', { name: 'Jiyuu developer' })
	await page.goto(`/u/${dev}`)
	await expect(check).toHaveCount(0)

	grant_verified(dev)
	await page.reload()
	await expect(page.locator('h2.name').getByRole('img', { name: 'Jiyuu developer' })).toBeVisible()
	await expect(
		page.locator('article.post', { hasText: text }).getByRole('img', { name: 'Jiyuu developer' }),
	).toBeVisible()
	await expect(
		page.locator('.acct-chip').getByRole('img', { name: 'Jiyuu developer' }),
	).toBeVisible()

	const other = await (await browser.newContext()).newPage()
	await sign_up(other, `e2e_vo_${id}`)
	await other.goto(`/u/e2e_vo_${id}`)
	await expect(other.locator('h2.name')).toBeVisible()
	await expect(other.getByRole('img', { name: 'Jiyuu developer' })).toHaveCount(0)
	await other.goto(`/u/${dev}`)
	await expect(other.locator('h2.name').getByRole('img', { name: 'Jiyuu developer' })).toBeVisible()
})
