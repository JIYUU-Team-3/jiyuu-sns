import { expect, test } from '@playwright/test'
import { sign_up } from '../../sign-up'

test('edit your own profile, including the handle @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const handle = `e2e_e_${id}`
	const renamed = `e2e_r_${id}`
	await sign_up(page, handle)

	await page.goto(`/u/${handle}`)
	await page.getByRole('link', { name: 'Edit profile' }).click()
	await expect(page).toHaveURL(/\/settings\/profile$/)

	const name = page.getByLabel(/Display name/)
	await expect(name).toHaveValue(handle)
	// Wait for hydration, so the fills below aren't wiped by it.
	await expect(async () => {
		await name.fill('Edited Name')
		await expect(name).toHaveValue('Edited Name', { timeout: 1_000 })
	}).toPass()
	await page.getByLabel('Bio (optional)').fill('Edited bio')
	await page.getByLabel('Username').fill(renamed)
	await page.getByRole('button', { name: 'Save' }).click()

	await expect(page).toHaveURL(new RegExp(`/u/${renamed}$`))
	const header = page.locator('section.top')
	await expect(header.getByRole('heading', { name: 'Edited Name' })).toBeVisible()
	await expect(header).toContainText(`@${renamed}`)
	await expect(header).toContainText('Edited bio')
	await expect(page.locator('.acct-chip')).toContainText(`@${renamed}`)

	// Saving again with the same handle doesn't count it as taken, and the page shows the new bio.
	await page.getByRole('link', { name: 'Edit profile' }).click()
	await expect(page.getByLabel('Username')).toHaveValue(renamed)
	const bio = page.getByLabel('Bio (optional)')
	await expect(async () => {
		await bio.fill('Second bio')
		await expect(bio).toHaveValue('Second bio', { timeout: 1_000 })
	}).toPass()
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${renamed}$`))
	await expect(header).toContainText('Second bio')
})

test('someone else’s profile has no edit link and keeps its handle @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const other = `e2e_o_${id}`
	const other_context = await browser.newContext()
	await sign_up(await other_context.newPage(), other)
	await sign_up(page, `e2e_v_${id}`)

	await page.goto(`/u/${other}`)
	await expect(page.getByRole('button', { name: `Follow @${other}` })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveCount(0)

	// Their handle can't be taken over from the edit page.
	await page.goto('/settings/profile')
	const username = page.getByLabel('Username')
	await expect(async () => {
		await username.fill(other)
		await expect(username).toHaveValue(other, { timeout: 1_000 })
	}).toPass()
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page.getByText(`@${other} is taken`)).toBeVisible()
	await expect(page).toHaveURL(/\/settings\/profile$/)

	await other_context.close()
})

test('picked photos are cropped to their shape before saving @writes', async ({ page }) => {
	const handle = `e2e_c_${crypto.randomUUID().slice(0, 8)}`
	await sign_up(page, handle)
	await page.goto('/settings/profile')

	// A 900×600 photo, so an uncropped upload would fail the shape checks below.
	const png = await page.evaluate(() => {
		const canvas = document.createElement('canvas')
		canvas.width = 900
		canvas.height = 600
		const context = canvas.getContext('2d')!
		context.fillStyle = '#3a7'
		context.fillRect(0, 0, 900, 600)
		return canvas.toDataURL('image/png').split(',')[1]!
	})
	const photo = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }

	for (const [field, title] of [
		['avatar', 'Crop photo'],
		['banner', 'Crop banner'],
	] as const) {
		await expect(async () => {
			await page.locator(`input[name=${field}]`).setInputFiles(photo)
			await expect(page.getByRole('dialog', { name: title })).toBeVisible({ timeout: 1_000 })
		}).toPass()
		await page.getByRole('button', { name: 'Apply' }).click()
		await expect(page.getByRole('dialog', { name: title })).toHaveCount(0)
	}
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${handle}$`))

	const shape = (selector: string) =>
		page.locator(selector).evaluate(async (img: HTMLImageElement) => {
			await img.decode()
			return img.naturalWidth / img.naturalHeight
		})
	expect(await shape('.ring img')).toBeCloseTo(1)
	expect(await shape('.banner img')).toBeCloseTo(3)

	// Both uploads can be removed again, back to the initials and the plain banner.
	await page.getByRole('link', { name: 'Edit profile' }).click()
	await expect(async () => {
		await page.getByRole('button', { name: 'Remove banner' }).click()
		await expect(page.getByRole('button', { name: 'Remove banner' })).toHaveCount(0, {
			timeout: 1_000,
		})
	}).toPass()
	await page.getByRole('button', { name: 'Remove photo' }).click()
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page).toHaveURL(new RegExp(`/u/${handle}$`))
	await expect(page.locator('.banner img')).toHaveCount(0)
	await expect(page.locator('.ring img')).toHaveCount(0)
})
