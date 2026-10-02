import { expect, test } from '@playwright/test'
import { follow } from '../follow'
import { sign_up } from '../sign-up'

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
	// New accounts can only start a chat with someone who follows them.
	await follow(page, bob)

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
	await expect(bob_page.locator('.msg', { hasText: hello }).getByText('Delivered')).toBeVisible({
		timeout: 15_000,
	})
	await nav.getByRole('link', { name: /Messages/ }).click()
	await page.getByRole('link', { name: new RegExp(hello) }).click()
	await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
	const message = page.locator('.msg', { hasText: hello })
	await expect(message).toBeVisible()
	await expect(nav.getByRole('link', { name: /unread/ })).toHaveCount(0)
	await expect(bob_page.locator('.msg', { hasText: hello }).getByText('Seen')).toBeVisible({
		timeout: 15_000,
	})

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
	await expect(reply.getByText('Seen')).toBeVisible({ timeout: 15_000 })
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

	await sign_up(page, owner)
	for (const handle of [first, second]) {
		const context = await browser.newContext()
		const other = await context.newPage()
		await sign_up(other, handle)
		// New accounts can only start a chat with people who follow them.
		await follow(other, owner)
		await context.close()
	}

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

test('a message turns delivered once a push reaches the other person @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dda_${id}`
	const hello = `Are you there ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(page, alice)
	await sign_up(bob_page, `e2e_ddb_${id}`)
	const delivered = { headers: { origin: new URL(page.url()).origin } }
	const stranger = await browser.newContext()
	expect((await stranger.request.post('/messages/delivered', delivered)).status()).toBe(401)
	await stranger.close()
	await page.goto('about:blank')

	await bob_page.goto(`/u/${alice}`)
	await bob_page.waitForLoadState('networkidle')
	await bob_page.getByRole('button', { name: `Message @${alice}` }).click()
	await expect(bob_page).toHaveURL(/\/messages\/[\w-]+$/)
	await bob_page.getByLabel('Message', { exact: true }).fill(hello)
	const stored = bob_page.waitForResponse((response) => response.url().includes('/send_message'))
	await bob_page.keyboard.press('Enter')
	await stored
	const sent = bob_page.locator('.msg', { hasText: hello })
	await expect(sent.getByText('Sent')).toBeVisible({ timeout: 15_000 })

	expect((await page.request.post('/messages/delivered', delivered)).status()).toBe(204)
	await expect(sent.getByText('Delivered')).toBeVisible({ timeout: 15_000 })

	await bob_context.close()
})

test('typing shows live, a sent message arrives at once, and the socket is members-only @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_lta_${id}`
	const hello = `Live ${id}`

	const bob_page = await (await browser.newContext()).newPage()
	const carol_page = await (await browser.newContext()).newPage()
	await sign_up(bob_page, `e2e_ltb_${id}`)
	await sign_up(carol_page, `e2e_ltc_${id}`)
	await sign_up(page, alice)

	await bob_page.goto(`/u/${alice}`)
	await bob_page.waitForLoadState('networkidle')
	await bob_page.getByRole('button', { name: `Message @${alice}` }).click()
	await expect(bob_page).toHaveURL(/\/messages\/[\w-]+$/)
	const chat = new URL(bob_page.url()).pathname
	const conversation = chat.split('/').pop() as string

	const ticket_call = page.waitForRequest((request) => request.url().includes('/live_ticket'))
	await page.goto(chat)
	const ticket_request = await ticket_call

	const field = page.getByLabel('Message', { exact: true })
	const bubble = bob_page.locator('.typing')
	await expect(async () => {
		await field.pressSequentially('x')
		await expect(bubble).toBeVisible({ timeout: 1_000 })
	}).toPass({ timeout: 20_000 })

	await field.fill(hello)
	await field.press('Enter')
	await expect(bob_page.locator('.msg', { hasText: hello })).toBeVisible({ timeout: 3_000 })
	await expect(bubble).toBeHidden()

	const origin = new URL(page.url()).origin
	const live = (headers: Record<string, string>, ticket = 'junk') =>
		page.request.get(`/live/${conversation}?ticket=${ticket}`, { headers })
	expect((await live({ origin })).status()).toBe(426)
	expect((await live({ origin, upgrade: 'websocket' })).status()).toBe(401)
	expect((await live({ origin: 'https://evil.example', upgrade: 'websocket' })).status()).toBe(403)

	const stolen = await carol_page.request.post(ticket_request.url(), {
		headers: { origin, 'content-type': ticket_request.headers()['content-type'] },
		data: ticket_request.postData() ?? '',
	})
	expect(await stolen.json()).toMatchObject({ type: 'error', error: { status: 404 } })

	await bob_page.context().close()
	await carol_page.context().close()
})
