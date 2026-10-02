import { expect, test, type Locator } from '@playwright/test'
import { sign_up } from '../sign-up'

async function paste_file(field: Locator, name: string, type: string, bytes: number[]) {
	await field.evaluate(
		(element, { name, type, bytes }) => {
			const clipboardData = new DataTransfer()
			clipboardData.items.add(new File([new Uint8Array(bytes)], name, { type }))
			const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
			// Firefox ignores clipboardData in the constructor (Mozilla bug 2027025).
			Object.defineProperty(event, 'clipboardData', { value: clipboardData })
			element.dispatchEvent(event)
		},
		{ name, type, bytes },
	)
}

test('paste and send DM files, keep image previews, and restrict downloads @writes', async ({
	page,
	browser,
}) => {
	test.setTimeout(90_000)
	const id = crypto.randomUUID().slice(0, 8)
	const sender = `e2e_dmf_${id}`
	const recipient = `e2e_dmr_${id}`
	const recipient_context = await browser.newContext()
	const recipient_page = await recipient_context.newPage()
	const outsider_context = await browser.newContext()
	try {
		await sign_up(page, sender)
		await sign_up(recipient_page, recipient)
		await sign_up(await outsider_context.newPage(), `e2e_dmx_${id}`)
		await page.goto(`/u/${recipient}`)
		await page.waitForLoadState('networkidle')
		await page.getByRole('button', { name: `Message @${recipient}` }).click()
		await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
		const conversation = new URL(page.url()).pathname
		const field = page.getByLabel('Message', { exact: true })
		const compose = page.locator('.compose')
		const send = compose.getByRole('button', { name: 'Send', exact: true })
		const name = `資料-${id}.html`
		const content = '<html><script>alert(1)</script>attachment</html>'
		const bytes = Array.from(new TextEncoder().encode(content))

		await field.fill('Caption stays')
		await field.evaluate((element) => {
			const clipboardData = new DataTransfer()
			clipboardData.setData('text/plain', 'ordinary text')
			const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
			Object.defineProperty(event, 'clipboardData', { value: clipboardData })
			if (!element.dispatchEvent(event)) throw new Error('Text paste was prevented')
		})
		await expect(field).toHaveValue('Caption stays')
		const upload = page.waitForResponse(
			(response) =>
				response.url().endsWith('/media/messages') && response.request().method() === 'POST',
		)
		await paste_file(field, name, 'text/html', bytes)
		const upload_response = await upload
		expect(upload_response.status()).toBe(201)
		const { url } = await upload_response.json()
		await expect(compose.getByText(name, { exact: true })).toBeVisible()
		await expect(field).toHaveValue('Caption stays')
		await expect(send).toBeEnabled()
		const stored = page.waitForResponse((response) => response.url().includes('/send_message'))
		await send.click()
		await stored
		const link = page.locator('.msg').getByRole('link', { name: new RegExp(name) })
		await expect(link).toBeVisible()
		await page.reload()
		await expect(link).toBeVisible()
		await recipient_page.goto(conversation)
		await expect(
			recipient_page.locator('.msg').getByRole('link', { name: new RegExp(name) }),
		).toBeVisible()
		const response = await recipient_page.request.get(url)
		expect(response.status()).toBe(200)
		expect(response.headers()['content-type']).toBe('application/octet-stream')
		expect(response.headers()['content-disposition']).toContain('attachment;')
		expect(response.headers()['content-disposition']).toContain(encodeURIComponent(name))
		expect(await response.text()).toBe(content)
		const downloaded = page.waitForEvent('download')
		await link.click()
		expect((await downloaded).suggestedFilename()).toBe(name)
		expect((await outsider_context.request.get(url)).status()).toBe(404)
		expect(
			(
				await page.request.delete(url, { headers: { origin: new URL(page.url()).origin } })
			).status(),
		).toBe(409)

		// Clipboard screenshots retain the existing inline photo preview.
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',
			'base64',
		)
		await paste_file(field, 'screenshot.png', 'image/png', Array.from(png))
		await expect(compose.locator('.thumb img')).toBeVisible()
		await expect(send).toBeEnabled()
		await send.click()
		await expect(page.locator('.msg img[alt="Photo"]')).toBeVisible()

		// The picker also accepts general files; removal discards unsent uploads.
		const picked = page.waitForResponse(
			(response) =>
				response.url().endsWith('/media/messages') && response.request().method() === 'POST',
		)
		await compose.locator('input[type=file]').setInputFiles({
			name: 'notes.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.7'),
		})
		const { url: picked_url } = await (await picked).json()
		await expect(send).toBeEnabled()
		await compose.getByRole('button', { name: 'Remove attachment' }).click()
		await expect(send).toBeDisabled()
		await expect.poll(async () => (await page.request.get(picked_url)).status()).toBe(404)
		const oversized = await page.request.post('/media/messages', {
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
	} finally {
		await recipient_context.close()
		await outsider_context.close()
	}
})

test('message someone, react and reply, and the badge clears once read @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dma_${id}`
	const bob = `e2e_dmb_${id}`
	const hello = `Hello Alice ${id}`
	const answer = `Hi Bob ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(page, alice)
	await sign_up(bob_page, bob)

	await bob_page.goto(`/u/${alice}`)
	await bob_page.waitForLoadState('networkidle')
	await bob_page.getByRole('button', { name: `Message @${alice}` }).click()
	await expect(bob_page).toHaveURL(/\/messages\/[\w-]+$/)
	await bob_page.getByLabel('Message', { exact: true }).fill(hello)
	// The chat shows a message before the server has it, so wait for the server too: Alice's
	// unread badge only counts what was stored.
	const stored = bob_page.waitForResponse((response) => response.url().includes('/send_message'))
	await bob_page.keyboard.press('Enter')
	await expect(bob_page.locator('.chat').getByText(hello)).toBeVisible()
	await stored

	await page.goto('/')
	const nav = page.locator('nav.side')
	await expect(nav.getByRole('link', { name: /Messages.*1 unread/ })).toBeVisible()
	await nav.getByRole('link', { name: /Messages/ }).click()
	await page.getByRole('link', { name: new RegExp(hello) }).click()
	await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
	const message = page.locator('.msg', { hasText: hello })
	await expect(message).toBeVisible()
	await expect(nav.getByRole('link', { name: /unread/ })).toHaveCount(0)

	await message.hover()
	await message.getByRole('button', { name: 'React', exact: true }).click()
	await page.getByRole('button', { name: 'React with 👍' }).click()
	await expect(message.getByRole('button', { name: /👍 1/ })).toBeVisible()

	await message.getByRole('button', { name: 'Reply', exact: true }).click()
	await expect(page.getByText(`Replying to ${bob}: ${hello}`)).toBeVisible()
	await page.getByLabel('Message', { exact: true }).fill(answer)
	await page.getByRole('button', { name: 'Send' }).click()
	const reply = page.locator('.msg', { hasText: answer })
	await expect(reply).toBeVisible()
	await expect(reply.getByText(`Replying to ${bob}`)).toBeVisible()

	const bob_reply = bob_page.locator('.msg', { hasText: answer })
	await expect(bob_reply).toBeVisible({ timeout: 15_000 })
	await expect(bob_reply.getByText('Replying to you')).toBeVisible()
	await expect(
		bob_page.locator('.msg', { hasText: hello }).getByRole('button', { name: /👍 1/ }),
	).toBeVisible()

	await bob_context.close()
})

test('start a named group chat from the new message dialog @writes', async ({ page, browser }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const owner = `e2e_dmg_${id}`
	const first = `e2e_dmh_${id}`
	const second = `e2e_dmi_${id}`
	const group = `Study group ${id}`

	for (const handle of [first, second]) {
		const context = await browser.newContext()
		await sign_up(await context.newPage(), handle)
		await context.close()
	}
	await sign_up(page, owner)

	await page.goto('/messages')
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'New message' }).first().click()
	const dialog = page.getByRole('dialog')
	const search = dialog.getByLabel('Search people')
	for (const handle of [first, second]) {
		await search.fill(handle)
		await dialog.getByRole('checkbox', { name: `Select ${handle}` }).check()
	}
	await dialog.getByLabel('Group name (optional)').fill(group)
	await dialog.getByRole('button', { name: 'Next' }).click()

	await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
	await expect(page.getByRole('heading', { name: group })).toBeVisible()
	await expect(page.getByText('3 members')).toBeVisible()
	await page.getByLabel('Message', { exact: true }).fill(`Welcome ${id}`)
	await page.keyboard.press('Enter')
	await expect(page.locator('nav').getByRole('link', { name: new RegExp(group) })).toBeVisible()
})
