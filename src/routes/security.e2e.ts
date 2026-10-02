import { expect, test, type Page, type Request } from '@playwright/test'
import { sign_up } from './(app)/sign-up'

/** A 1×1 PNG. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
)

const unique = () => crypto.randomUUID().slice(0, 8)

/** SvelteKit only takes form posts that say they come from the site itself. */
const from_site = (page: Page) => ({ origin: new URL(page.url()).origin })

const upload = (page: Page, file?: Buffer, to = '/media') =>
	page.request.post(to, {
		headers: from_site(page),
		multipart: file
			? { file: { name: 'dot.png', mimeType: 'image/png', buffer: file } }
			: { note: 'no file' },
	})

test('a signed-out caller is refused what a signed-in reader gets @writes', async ({
	page,
	playwright,
}) => {
	// Home asks who has posted since it loaded as soon as it's on screen.
	const news = page.waitForRequest((request) => request.url().includes('/get_new_posts'))
	await sign_up(page, `e2e_s_${unique()}`)
	// The first page comes with its data; switching tabs makes the browser ask for a feed.
	const feed = page.waitForRequest((request) => request.url().includes('/get_feed'))
	await page.getByRole('tab', { name: 'Following' }).click()
	const urls = [(await feed).url(), (await news).url()]

	const anonymous = await playwright.request.newContext()
	for (const url of urls) {
		// Remote functions answer 200 and carry the real status in the body.
		const mine = await (await page.request.get(url)).json()
		expect(mine.type).toBe('result')

		const refused = await (await anonymous.get(url)).json()
		expect(refused).toMatchObject({ type: 'error', error: { status: 401 } })
	}
	await anonymous.dispose()
})

test('an account that skipped onboarding cannot upload @writes', async ({ page }) => {
	const name = `e2e_n_${unique()}`
	const account = await page.request.post('/api/auth/sign-up/email', {
		data: { email: `${name}@example.test`, password: crypto.randomUUID(), name },
	})
	expect(account.ok()).toBe(true)
	await page.goto('/')
	await expect(page).toHaveURL(/\/onboarding$/)

	expect((await upload(page, PNG)).status()).toBe(403)
	expect((await upload(page, PNG, '/media/messages')).status()).toBe(403)
})

test('a chat and its photos are closed to people who are not in it @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const alice = `e2e_ma_${id}`
	const pages: Page[] = []
	for (const handle of [`e2e_mb_${id}`, `e2e_mc_${id}`]) {
		const other = await (await browser.newContext()).newPage()
		await sign_up(other, handle)
		pages.push(other)
	}
	const [bob, carol] = pages
	await sign_up(page, alice)

	// Bob opens a chat with Alice; the page asks for its messages.
	await bob.goto(`/u/${alice}`)
	await bob.waitForLoadState('networkidle')
	const asked = bob.waitForRequest((request) => request.url().includes('/get_messages'))
	await bob.getByRole('button', { name: `Message @${alice}` }).click()
	const url = (await asked).url()
	await bob.getByLabel('Message', { exact: true }).fill(`Only for Alice ${id}`)
	// The chat shows a message before the server has it; wait until it's stored.
	const stored = bob.waitForResponse((response) => response.url().includes('/send_message'))
	await bob.keyboard.press('Enter')
	await stored

	const theirs = await (await page.request.get(url)).json()
	expect(theirs.type).toBe('result')
	expect(theirs.data).toContain(`Only for Alice ${id}`)
	const outsider = await (await carol.request.get(url)).json()
	expect(outsider).toMatchObject({ type: 'error', error: { status: 404 } })

	// A photo Bob uploaded for a message opens for him and for nobody else.
	const sent = await upload(bob, PNG, '/media/messages')
	expect(sent.status()).toBe(201)
	const photo = (await sent.json()).url as string
	expect((await bob.request.get(photo)).ok()).toBe(true)
	expect((await carol.request.get(photo)).status()).toBe(404)

	for (const other of pages) await other.context().close()
})

test('an account photo pointed at another site is never shown @writes', async ({ page }) => {
	const handle = `e2e_a_${unique()}`
	await sign_up(page, handle)
	const changed = await page.request.post('/api/auth/update-user', {
		headers: from_site(page),
		data: { image: 'https://tracker.example/pixel.png' },
	})
	expect(changed.ok()).toBe(true)

	await page.goto(`/u/${handle}`)
	await expect(page.locator('h1')).toHaveText(handle)
	await expect(page.locator('img[src*="tracker.example"]')).toHaveCount(0)
})

test('uploads are refused once an account passes its limit @writes', async ({ page }) => {
	await sign_up(page, `e2e_r_${unique()}`)
	expect((await upload(page, PNG)).status()).toBe(201)

	// Empty forms: counted like any upload, but nothing is stored.
	const statuses: number[] = []
	for (let batch = 0; batch < 10; batch++) {
		const responses = await Promise.all(Array.from({ length: 10 }, () => upload(page)))
		statuses.push(...responses.map((response) => response.status()))
	}
	expect(statuses).toContain(400)
	expect(statuses).toContain(429)
})

async function post_path(page: Page, text: string) {
	await page.goto('/')
	await page.waitForLoadState('networkidle')
	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer
		.locator('input[type="file"]')
		.setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG })
	await expect(composer.getByRole('button', { name: 'Remove' })).toHaveCount(1)
	const post = composer.getByRole('button', { name: 'Post', exact: true })
	await expect(post).toBeEnabled()
	await post.click()
	const card = page.locator('article.post', { hasText: text })
	const photo = card.locator('img[src^="/media/posts/"]').first()
	return {
		path: (await card.locator('a[href*="/p/"]').first().getAttribute('href')) as string,
		photo: (await photo.getAttribute('src')) as string,
	}
}

async function blocks(page: Page, handle: string) {
	await page.goto(`/u/${handle}`)
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await page.getByRole('menuitem', { name: `Block @${handle}` }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Block', exact: true }).click()
	await expect(page.getByText(`You blocked @${handle}`)).toBeVisible()
}

async function replay(page: Page, request: Request) {
	const response = await page.request.post(request.url(), {
		headers: { ...from_site(page), 'content-type': request.headers()['content-type'] },
		data: request.postData() ?? '',
	})
	return response.json()
}

test('a private account and a blocker keep their posts from direct requests @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const alice = `e2e_va_${id}`
	const pages: Page[] = []
	for (const handle of [`e2e_vb_${id}`, `e2e_vc_${id}`]) {
		const other = await (await browser.newContext()).newPage()
		await sign_up(other, handle)
		pages.push(other)
	}
	const [bob, carol] = pages
	await sign_up(page, alice)
	const loose = (await (await upload(page, PNG)).json()).url as string
	expect((await page.request.get(loose)).ok()).toBe(true)
	expect((await bob.request.get(loose)).status()).toBe(404)

	const { path, photo } = await post_path(page, `Closed ${id}`)
	expect((await bob.request.get(path)).status()).toBe(200)
	expect((await bob.request.get(photo)).ok()).toBe(true)

	await blocks(page, `e2e_vb_${id}`)
	expect((await bob.request.get(path)).status()).toBe(404)
	expect((await bob.request.get(photo)).status()).toBe(404)
	expect((await carol.request.get(photo)).ok()).toBe(true)

	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	await page.getByRole('switch', { name: /Private account/ }).click()
	await expect(page.getByRole('switch', { name: /Private account/ })).toHaveAttribute(
		'aria-checked',
		'true',
	)
	expect((await carol.request.get(path)).status()).toBe(404)
	expect((await carol.request.get(photo)).status()).toBe(404)
	expect((await page.request.get(path)).status()).toBe(200)
	expect((await page.request.get(photo)).ok()).toBe(true)

	for (const other of pages) await other.context().close()
})

test('the posted pill leaves out someone the reader blocked @writes', async ({ page, browser }) => {
	const id = unique()
	const bob = `e2e_ub_${id}`
	// Home asks who has posted since it loaded as soon as it's on screen.
	const news = page.waitForRequest((request) => request.url().includes('/get_new_posts'))
	await sign_up(page, `e2e_ua_${id}`)
	const url = (await news).url()

	const bob_page = await (await browser.newContext()).newPage()
	await sign_up(bob_page, bob)
	const composer = bob_page.locator('form.inline')
	await composer.getByLabel('Post text').fill(`Pill ${id}`)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(bob_page.getByText('Your post was sent.')).toBeVisible()
	await bob_page.context().close()

	const before = await (await page.request.get(url)).json()
	expect(before.type).toBe('result')
	expect(before.data).toContain(bob)

	await blocks(page, bob)
	const after = await (await page.request.get(url)).json()
	expect(after.type).toBe('result')
	expect(after.data).not.toContain(bob)
})

test('the server refuses a reply the author did not allow @writes', async ({ page, browser }) => {
	const id = unique()
	const bob = `e2e_wb_${id}`
	const pages: Page[] = []
	for (const handle of [bob, `e2e_wc_${id}`]) {
		const other = await (await browser.newContext()).newPage()
		await sign_up(other, handle)
		pages.push(other)
	}
	const [bob_page, carol] = pages
	await sign_up(page, `e2e_wa_${id}`)

	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(`Just @${bob} ${id}`)
	await composer.getByRole('button', { name: 'Everyone can reply' }).click()
	await page.getByRole('menuitemradio', { name: 'Only people you mention can reply' }).click()
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	const card = page.locator('article.post', { hasText: `Just @${bob} ${id}` })
	const path = (await card.locator('a[href*="/p/"]').first().getAttribute('href')) as string

	await bob_page.goto(path)
	await bob_page.waitForLoadState('networkidle')
	const reply = bob_page.locator('form.reply')
	await reply.getByLabel('Post text').fill(`Allowed ${id}`)
	const sent = bob_page.waitForRequest((request) => request.url().includes('/create_post'))
	await reply.getByRole('button', { name: 'Reply', exact: true }).click()
	const request = await sent
	await expect(bob_page.getByText('Your reply was sent.')).toBeVisible()

	const refused = await replay(carol, request)
	expect(refused).toMatchObject({ type: 'error', error: { status: 403 } })

	for (const other of pages) await other.context().close()
})

test('a blocked person can no longer message the blocker @writes', async ({ page, browser }) => {
	const id = unique()
	const alice = `e2e_xa_${id}`
	const bob = await (await browser.newContext()).newPage()
	await sign_up(bob, `e2e_xb_${id}`)
	await sign_up(page, alice)

	await bob.goto(`/u/${alice}`)
	await bob.waitForLoadState('networkidle')
	const started = bob.waitForRequest((request) => request.url().includes('/start_conversation'))
	await bob.getByRole('button', { name: `Message @${alice}` }).click()
	const start = await started
	await bob.getByLabel('Message', { exact: true }).fill(`Before ${id}`)
	const sending = bob.waitForRequest((request) => request.url().includes('/send_message'))
	await bob.keyboard.press('Enter')
	const send = await sending
	await bob.waitForResponse((response) => response.url().includes('/send_message'))

	await blocks(page, `e2e_xb_${id}`)
	expect(await replay(bob, send)).toMatchObject({ type: 'error', error: { status: 403 } })
	expect(await replay(bob, start)).toMatchObject({ type: 'error', error: { status: 400 } })

	await bob.context().close()
})
