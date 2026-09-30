import { expect, test } from '@playwright/test'
import { sign_up } from '../../sign-up'

test('post a thread and follow the conversation @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const first = `Thread start ${id}`
	const second = `Thread middle ${id}`
	const reply = `Thread reply ${id}`
	await sign_up(page, `e2e_th_${id}`)

	const dialog = page.getByRole('dialog')
	await expect(async () => {
		await page.getByRole('button', { name: 'New post' }).first().click()
		await expect(dialog).toBeVisible({ timeout: 1_000 })
	}).toPass()
	await dialog.getByLabel('Post text').fill(first)
	await dialog.getByRole('button', { name: 'Add another post' }).click()
	await dialog.getByLabel('Post text').nth(1).fill(second)
	await dialog.getByRole('button', { name: 'Post all' }).click()
	await expect(page.getByText('Your thread was sent.')).toBeVisible()

	const card = page.locator('article.post', { hasText: first })
	await expect(card).toBeVisible()
	await expect(page.locator('article.post', { hasText: second })).toHaveCount(0)
	await card.getByRole('link', { name: 'Show this thread' }).click()

	await expect(page.locator('article.focus')).toContainText(first)
	const next = page.locator('article.post', { hasText: second })
	await expect(next).toBeVisible()
	await expect(next).not.toContainText('Replying to')
	await next.locator('a.time').click()

	await expect(page.locator('article.focus')).toContainText(second)
	await expect(page.locator('article.post', { hasText: first })).toBeVisible()
	const box = page.locator('form.reply')
	await box.getByLabel('Post text').fill(reply)
	await box.getByRole('button', { name: 'Reply', exact: true }).click()
	await expect(page.getByText('Your reply was sent.')).toBeVisible()
	await page.locator('article.post', { hasText: reply }).locator('a.time').click()

	await expect(page.locator('article.focus')).toContainText(reply)
	const above = page.locator('article.post')
	await expect(above.nth(0)).toContainText(first)
	await expect(above.nth(1)).toContainText(second)
})
