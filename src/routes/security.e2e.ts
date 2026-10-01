import { expect, test, type Page } from '@playwright/test'
import { grant_moderator } from './(app)/mod/grant'
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
	await sign_up(page, `e2e_s_${unique()}`)
	// The first page comes with its data; switching tabs makes the browser ask for a feed.
	const feed = page.waitForRequest((request) => request.url().includes('/get_feed'))
	await page.getByRole('tab', { name: 'Following' }).click()
	const url = (await feed).url()

	// Remote functions answer 200 and carry the real status in the body.
	const mine = await (await page.request.get(url)).json()
	expect(mine.type).toBe('result')

	const anonymous = await playwright.request.newContext()
	const refused = await (await anonymous.get(url)).json()
	expect(refused).toMatchObject({ type: 'error', error: { status: 401 } })
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

test('moderation tools answer 404 to anyone who is not a moderator @writes', async ({ page }) => {
	const handle = `e2e_x_${unique()}`
	await sign_up(page, handle)

	expect((await page.goto('/mod'))?.status()).toBe(404)
	expect((await page.goto(`/mod/u/${handle}`))?.status()).toBe(404)
	// Form actions skip the layout, so each checks the role itself.
	const suspend = await page.request.post(`/mod/u/${handle}?/suspend`, {
		headers: from_site(page),
		form: { reason: 'spam', days: '1' },
	})
	expect(suspend.status()).toBe(404)
	const dismiss = await page.request.post('/mod?/dismiss', {
		headers: from_site(page),
		form: { case: crypto.randomUUID() },
	})
	expect(dismiss.status()).toBe(404)

	await page.goto('/')
	await expect(page).toHaveURL(/\/$/)
})

test('a suspended account is refused everything but its suspension page @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const member = `e2e_sm_${id}`
	const mod_page = await (await browser.newContext()).newPage()
	await sign_up(mod_page, `e2e_sd_${id}`)
	grant_moderator(`e2e_sd_${id}`)
	await sign_up(page, member)

	// What the account could reach before: a feed request and its own upload.
	const feed = page.waitForRequest((request) => request.url().includes('/get_feed'))
	await page.getByRole('tab', { name: 'Following' }).click()
	const feed_url = (await feed).url()
	const photo = (await (await upload(page, PNG)).json()).url as string

	const suspended = await mod_page.request.post(`/mod/u/${member}?/suspend`, {
		headers: from_site(mod_page),
		form: { reason: 'spam', days: '1' },
	})
	expect(suspended.ok()).toBe(true)

	await page.goto('/')
	await expect(page).toHaveURL(/\/suspended$/)
	await page.goto(`/u/${member}`)
	await expect(page).toHaveURL(/\/suspended$/)
	expect((await page.request.get(feed_url)).status()).toBe(403)
	expect((await page.request.get(photo)).status()).toBe(403)
	expect((await upload(page, PNG)).status()).toBe(403)
	const renamed = await page.request.post('/api/auth/update-user', {
		headers: from_site(page),
		data: { name: 'Renamed while suspended' },
	})
	expect(renamed.status()).toBe(403)
	// The public pages stay open.
	await page.goto('/guidelines')
	await expect(page.getByRole('heading', { name: 'Community Guidelines' })).toBeVisible()

	await mod_page.context().close()
})

test('nobody can take the moderator handle, and a moderator cannot change theirs @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const newcomer = await (await browser.newContext()).newPage()
	const name = `e2e_h_${id}`
	const account = await newcomer.request.post('/api/auth/sign-up/email', {
		data: { email: `${name}@example.test`, password: crypto.randomUUID(), name },
	})
	expect(account.ok()).toBe(true)
	await newcomer.goto('/onboarding')
	const taken = await newcomer.request.post('/onboarding', {
		headers: from_site(newcomer),
		multipart: { name, handle: 'jiyuu_org', bio: '' },
	})
	expect(taken.status()).toBe(400)
	await newcomer.goto('/')
	await expect(newcomer).toHaveURL(/\/onboarding$/)
	await newcomer.context().close()

	const mod = `e2e_hm_${id}`
	await sign_up(page, mod)
	grant_moderator(mod)
	const renamed = await page.request.post('/settings/profile', {
		headers: from_site(page),
		multipart: { name: mod, handle: `e2e_hn_${id}`, bio: '' },
	})
	expect(renamed.status()).toBe(400)
	await page.goto(`/u/${mod}`)
	await expect(page.locator('h1')).toHaveText(mod)
})
