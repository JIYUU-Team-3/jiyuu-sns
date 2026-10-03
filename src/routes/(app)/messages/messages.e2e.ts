import { expect, test, type Page } from '@playwright/test'
import { follow } from '../follow'
import { sign_up } from '../sign-up'

const slow = { timeout: 15_000 }
const msg = (page: Page, text: string) => page.locator('.msg', { hasText: text })

async function befriend(page: Page, other: Page, alice: string, bob: string) {
	await sign_up(page, alice)
	await sign_up(other, bob)
	await follow(page, bob)
}

async function open_chat(page: Page, handle: string) {
	await page.goto(`/u/${handle}`)
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: `Message @${handle}` }).click()
	await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
}

async function send(page: Page, text: string) {
	const stored = page.waitForResponse((response) => response.url().includes('/send_message'))
	await page.getByLabel('Message', { exact: true }).fill(text)
	await page.keyboard.press('Enter')
	await stored
}

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
	// New accounts can only start a chat with someone who follows them.
	await befriend(page, bob_page, alice, bob)

	await open_chat(bob_page, alice)
	// The chat shows a message before the server has it, so wait for the server too: Alice's
	// unread badge only counts what was stored.
	await send(bob_page, hello)
	await expect(msg(bob_page, hello)).toBeVisible()

	await page.goto('/')
	const nav = page.locator('nav.side')
	await expect(nav.getByRole('link', { name: /Messages.*1 unread/ })).toBeVisible()
	await expect(msg(bob_page, hello).getByText('Delivered')).toBeVisible(slow)
	await nav.getByRole('link', { name: /Messages/ }).click()
	await page.getByRole('link', { name: new RegExp(hello) }).click()
	await expect(page).toHaveURL(/\/messages\/[\w-]+$/)
	const message = msg(page, hello)
	await expect(message).toBeVisible()
	await expect(nav.getByRole('link', { name: /unread/ })).toHaveCount(0)
	await expect(msg(bob_page, hello).getByText('Seen')).toBeVisible(slow)

	await message.hover()
	await message.getByRole('button', { name: 'React', exact: true }).click()
	await page.getByRole('button', { name: 'React with 👍' }).click()
	await expect(message.getByRole('button', { name: /👍 1/ })).toBeVisible()

	await message.getByRole('button', { name: 'Reply', exact: true }).click()
	await expect(page.getByText(`Replying to ${bob}: ${hello}`)).toBeVisible()
	await page.getByLabel('Message', { exact: true }).fill(answer)
	await page.getByRole('button', { name: 'Send' }).click()
	const reply = msg(page, answer)
	await expect(reply).toBeVisible()
	await expect(reply.getByText(`Replying to ${bob}`)).toBeVisible()

	const bob_reply = msg(bob_page, answer)
	await expect(bob_reply).toBeVisible(slow)
	await expect(bob_reply.getByText('Replying to you')).toBeVisible()
	await expect(reply.getByText('Seen')).toBeVisible(slow)
	await expect(msg(bob_page, hello).getByRole('button', { name: /👍 1/ })).toBeVisible()

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
	// New accounts can only start a chat with someone who follows them.
	await befriend(page, bob_page, alice, `e2e_ddb_${id}`)
	const delivered = { headers: { origin: new URL(page.url()).origin } }
	const stranger = await browser.newContext()
	expect((await stranger.request.post('/messages/delivered', delivered)).status()).toBe(401)
	await stranger.close()
	await page.goto('about:blank')

	await open_chat(bob_page, alice)
	await send(bob_page, hello)
	const sent = msg(bob_page, hello)
	await expect(sent.getByText('Sent')).toBeVisible(slow)

	expect((await page.request.post('/messages/delivered', delivered)).status()).toBe(204)
	await expect(sent.getByText('Delivered')).toBeVisible(slow)

	await bob_context.close()
})

test('typing shows live with a face, messages and reactions arrive at once, and the socket is members-only @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_lta_${id}`
	const hello = `Live ${id}`

	const bob_page = await (await browser.newContext()).newPage()
	const carol_page = await (await browser.newContext()).newPage()
	await sign_up(carol_page, `e2e_ltc_${id}`)
	// New accounts can only start a chat with someone who follows them.
	await befriend(page, bob_page, alice, `e2e_ltb_${id}`)

	await open_chat(bob_page, alice)
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
	await expect(bubble.locator('.av')).toHaveCount(1)

	await field.fill(hello)
	await field.press('Enter')
	await expect(msg(bob_page, hello)).toBeVisible({ timeout: 3_000 })
	await expect(bubble).toBeHidden()

	const received = msg(bob_page, hello)
	await received.hover()
	await received.getByRole('button', { name: 'React', exact: true }).click()
	await bob_page.getByRole('button', { name: 'React with 👍' }).click()
	await expect(msg(page, hello).getByRole('button', { name: /👍 1/ })).toBeVisible({
		timeout: 3_000,
	})

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

test('on a phone the chat stays in view above the keyboard @writes', async ({ page, browser }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dmk_${id}`
	const bob = `e2e_dml_${id}`

	const phone = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true })
	await phone.addInitScript(() => {
		const viewport = Object.assign(new EventTarget(), { height: innerHeight, offsetTop: 0 })
		Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
		Object.assign(window, {
			keyboard(height: number) {
				viewport.height = innerHeight - height
				viewport.offsetTop = 120
				viewport.dispatchEvent(new Event('resize'))
			},
		})
	})
	const bob_page = await phone.newPage()
	await befriend(page, bob_page, alice, bob)

	await open_chat(bob_page, alice)
	const field = bob_page.getByLabel('Message', { exact: true })
	await field.focus()
	const coarse = await bob_page.evaluate(() => matchMedia('(pointer: coarse)').matches)
	if (coarse) await expect(field).toHaveCSS('font-size', '16px')

	await bob_page.evaluate(() =>
		(window as unknown as { keyboard: (h: number) => void }).keyboard(300),
	)
	const bar = bob_page.locator('.pane header.bar')
	const compose = bob_page.locator('form.compose')
	await expect(compose).toHaveCSS('padding-bottom', '8px')
	await expect(async () => {
		expect((await bar.boundingBox())?.y).toBe(120)
		const box = await compose.boundingBox()
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBe(120 + 664 - 300)
	}).toPass()

	await phone.close()
})

test('a message is seen only once the reader comes back to the chat @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dms_${id}`
	const bob = `e2e_dmt_${id}`
	const first = `First ${id}`
	const second = `While away ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await befriend(page, bob_page, alice, bob)

	await open_chat(bob_page, alice)
	await send(bob_page, first)

	await page.goto(bob_page.url())
	await expect(msg(page, first)).toBeVisible()
	await expect(msg(bob_page, first).getByText('Seen')).toBeVisible(slow)

	await page.evaluate(() => {
		document.hasFocus = () => false
		window.dispatchEvent(new Event('blur'))
	})
	const marks: string[] = []
	page.on('request', (request) => {
		if (request.url().includes('/mark_conversation_read')) marks.push(request.url())
	})
	await bob_page.getByLabel('Message', { exact: true }).fill(second)
	await bob_page.keyboard.press('Enter')
	await expect(msg(page, second)).toBeVisible(slow)
	expect(marks).toHaveLength(0)
	await expect(msg(bob_page, second).getByText('Seen')).toHaveCount(0)

	await page.evaluate(() => {
		document.hasFocus = () => true
		window.dispatchEvent(new Event('focus'))
	})
	await expect(msg(bob_page, second).getByText('Seen')).toBeVisible(slow)

	await bob_context.close()
})

test('the message list and tab badge update the moment a message arrives @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dmu_${id}`
	const bob = `e2e_dmv_${id}`
	const first = `Earlier ${id}`
	const second = `Right now ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await befriend(page, bob_page, alice, bob)

	await open_chat(bob_page, alice)
	await send(bob_page, first)
	await page.goto(bob_page.url())
	await expect(msg(bob_page, first).getByText('Seen')).toBeVisible(slow)

	const inbox = page.waitForEvent('websocket', (socket) => socket.url().includes('/live/inbox'))
	await page.goto('/messages')
	await inbox
	const before_poll = Date.now() + 9_000
	const in_time = () => ({ timeout: Math.max(1, before_poll - Date.now()) })
	const nav = page.locator('nav.side')
	await expect(page.getByRole('link', { name: new RegExp(first) })).toBeVisible()
	await expect(nav.getByRole('link', { name: /unread/ })).toHaveCount(0)
	await page.waitForLoadState('networkidle')

	await bob_page.getByLabel('Message', { exact: true }).fill(second)
	await bob_page.keyboard.press('Enter')
	await expect(page.getByRole('link', { name: new RegExp(second) })).toBeVisible(in_time())
	await expect(nav.getByRole('link', { name: /Messages.*1 unread/ })).toBeVisible(in_time())

	await bob_context.close()
})

test('the reaction picker stays inside the chat on a short message @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_dmw_${id}`
	const bob = `e2e_dmx_${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await befriend(page, bob_page, alice, bob)

	await open_chat(bob_page, alice)
	await send(bob_page, 'Sup')

	for (const viewer of [page, bob_page]) {
		await viewer.goto(bob_page.url())
		const message = msg(viewer, 'Sup')
		await message.hover()
		await message.getByRole('button', { name: 'React', exact: true }).click()
		const chat = await viewer.locator('.pane .chat').boundingBox()
		const picker = await message.locator('.picker').boundingBox()
		expect(picker && chat).toBeTruthy()
		if (!picker || !chat) return
		expect(picker.x).toBeGreaterThanOrEqual(chat.x)
		expect(picker.x + picker.width).toBeLessThanOrEqual(chat.x + chat.width)
	}

	await bob_context.close()
})
