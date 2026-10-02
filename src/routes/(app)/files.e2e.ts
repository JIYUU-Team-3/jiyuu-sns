import { expect, test, type Locator } from '@playwright/test'
import { sign_up } from './sign-up'

async function paste(field: Locator, name: string, content: string, type = 'text/plain') {
	await field.evaluate(
		(element, data) => {
			const clipboardData = new DataTransfer()
			clipboardData.items.add(new File([data.content], data.name, { type: data.type }))
			const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
			// Firefox ignores clipboardData in the constructor (Mozilla bug 2027025).
			Object.defineProperty(event, 'clipboardData', { value: clipboardData })
			element.dispatchEvent(event)
		},
		{ name, content, type },
	)
}

test('paste files into posts and replies, keep downloads private, and clean removed files @writes', async ({
	page,
	browser,
}) => {
	test.setTimeout(90_000)
	const id = crypto.randomUUID().slice(0, 8)
	await sign_up(page, `e2e_files_${id}`)
	const form = page.locator('form.inline')
	const field = form.getByLabel('Post text')
	const body = `File post ${id}`
	const name = `資料-${id}.html`
	const content = '<script>alert(1)</script>download only'
	await field.fill(body)
	await field.evaluate((element) => {
		const clipboardData = new DataTransfer()
		clipboardData.setData('text/plain', 'ordinary text')
		const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: clipboardData })
		if (!element.dispatchEvent(event)) throw new Error('Text paste was prevented')
	})
	const uploaded = page.waitForResponse(
		(response) => response.url().endsWith('/media') && response.request().method() === 'POST',
	)
	await paste(field, name, content, 'text/html')
	const { url } = await (await uploaded).json()
	await expect(form.getByText(name, { exact: true })).toBeVisible()
	await expect(field).toHaveValue(body)
	await expect(form.getByRole('button', { name: 'Post', exact: true })).toBeEnabled()
	const stored = page.waitForResponse((response) => response.url().includes('/create_post'))
	await form.getByRole('button', { name: 'Post', exact: true }).click()
	await stored
	const card = page.locator('article.post', { hasText: body }).first()
	await expect(card.getByRole('link', { name: new RegExp(name) })).toBeVisible()
	await page.reload({ waitUntil: 'networkidle' })
	await expect(card.getByRole('link', { name: new RegExp(name) })).toBeVisible()
	await card.locator('a[href*="/p/"]').first().click()
	const postUrl = page.url()
	const focus = page.locator('article.focus')
	const downloaded = page.waitForEvent('download')
	await focus.getByRole('link', { name: new RegExp(name) }).click()
	expect((await downloaded).suggestedFilename()).toBe(name)
	const download = await page.request.get(url)
	expect(download.status()).toBe(200)
	expect(download.headers()['content-type']).toBe('application/octet-stream')
	expect(download.headers()['content-disposition']).toContain(encodeURIComponent(name))
	expect(download.headers()['x-content-type-options']).toBe('nosniff')
	expect(await download.text()).toBe(content)
	const headers = { origin: new URL(page.url()).origin }
	expect((await page.request.delete(url, { headers })).status()).toBe(409)
	const other = await browser.newContext()
	try {
		expect((await other.request.get(url)).status()).toBe(401)
		const reader = await other.newPage()
		await sign_up(reader, `e2e_rf_${id}`)
		await reader.goto(postUrl)
		await expect(reader.getByRole('link', { name: new RegExp(name) })).toBeVisible()
		expect((await other.request.get(url)).status()).toBe(200)
		expect((await other.request.delete(url, { headers })).status()).toBe(404)
	} finally {
		await other.close()
	}

	// The inline reply supports a file without any text.
	const reply = page.locator('form.reply')
	await paste(reply.getByLabel('Post text'), 'reply.txt', `Reply file ${id}`)
	await expect(reply.getByRole('button', { name: 'Reply', exact: true })).toBeEnabled()
	const replied = page.waitForResponse((response) => response.url().includes('/create_post'))
	await reply.getByRole('button', { name: 'Reply', exact: true }).click()
	await replied
	await expect(page.locator('article.post').getByRole('link', { name: /reply.txt/ })).toBeVisible()
	await page.reload({ waitUntil: 'networkidle' })
	await expect(page.locator('article.post').getByRole('link', { name: /reply.txt/ })).toBeVisible()

	// Editing keeps the stored file metadata, and dropping the file deletes its bytes.
	await page.waitForLoadState('networkidle')
	await expect(async () => {
		await focus.getByRole('button', { name: 'More options' }).click()
		await expect(page.getByRole('menuitem', { name: 'Edit post' })).toBeVisible({ timeout: 1_000 })
	}).toPass({ timeout: 10_000 })
	await page.getByRole('menuitem', { name: 'Edit post' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.getByText(name, { exact: true })).toBeVisible()
	await dialog.getByLabel('Post text').fill(`${body} edited`)
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(focus.getByRole('link', { name: new RegExp(name) })).toBeVisible()
	await focus.getByRole('button', { name: 'More options' }).click()
	await page.getByRole('menuitem', { name: 'Edit post' }).click()
	await dialog.getByRole('button', { name: 'Remove', exact: true }).click()
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(focus.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
	expect((await page.request.get(url)).status()).toBe(404)

	await page.goto('/', { waitUntil: 'networkidle' })
	const picked = page.waitForResponse(
		(response) => response.url().endsWith('/media') && response.request().method() === 'POST',
	)
	await form
		.locator('input[type=file]')
		.setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) })
	const { url: emptyUrl } = await (await picked).json()
	await expect(form.getByText('empty.txt', { exact: true })).toBeVisible()
	await expect(form.getByRole('button', { name: 'Post', exact: true })).toBeEnabled()
	await form.getByRole('button', { name: 'Remove', exact: true }).click()
	await expect.poll(async () => (await page.request.get(emptyUrl)).status()).toBe(404)
	const oversized = await page.request.post('/media', {
		headers: { origin: new URL(page.url()).origin },
		multipart: {
			file: {
				name: 'large.bin',
				mimeType: 'application/octet-stream',
				buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
			},
		},
	})
	expect(oversized.status()).toBe(413)
})

test('paste into every thread entry and mix downloadable files with image previews @writes', async ({
	page,
}) => {
	test.setTimeout(60_000)
	const id = crypto.randomUUID().slice(0, 8)
	await sign_up(page, `e2e_tf_${id}`)
	await page.getByRole('button', { name: 'New post', exact: true }).click()
	const dialog = page.getByRole('dialog')
	const first = dialog.getByLabel('Post text').first()
	await first.fill(`File thread ${id}`)
	await paste(first, `first-${id}.txt`, 'First file')
	await expect(dialog.getByRole('button', { name: 'Add another post' })).toBeEnabled()
	await dialog.getByRole('button', { name: 'Add another post' }).click()
	const second = dialog.getByLabel('Post text').nth(1)
	await paste(second, `second-${id}.csv`, 'one,two')
	const tools = dialog.locator('input[type=file]')
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQv8BD/kD/YURmXYAAAAASUVORK5CYII=',
		'base64',
	)
	await tools.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })
	await expect(dialog.getByRole('button', { name: 'Post all' })).toBeEnabled()
	const stored = page.waitForResponse((response) => response.url().includes('/create_thread'))
	await dialog.getByRole('button', { name: 'Post all' }).click()
	await stored
	const card = page.locator('article.post', { hasText: `File thread ${id}` }).first()
	await card.getByRole('link', { name: 'Show this thread' }).click()
	await expect(page).toHaveURL(/\/p\/[\w-]+$/)
	await expect(page.getByRole('link', { name: new RegExp(`first-${id}.txt`) })).toBeVisible()
	await expect(page.getByRole('link', { name: new RegExp(`second-${id}.csv`) })).toBeVisible()
	await expect(page.locator('article.post img[alt="Photo 1 of 1"]')).toBeVisible()
	await page.reload({ waitUntil: 'networkidle' })
	await expect(page.getByRole('link', { name: new RegExp(`second-${id}.csv`) })).toBeVisible()
})
