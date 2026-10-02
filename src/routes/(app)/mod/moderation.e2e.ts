import { expect, test, type Page } from '@playwright/test'
import { sign_up } from '../sign-up'
import { age_removal, grant_moderator, settle_account } from './local-db'

const unique = () => crypto.randomUUID().slice(0, 8)

test('a moderator suspends an account, reads its review request and lifts it @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const mod = `e2e_md_${id}`
	const member = `e2e_mm_${id}`
	const other = await (await browser.newContext()).newPage()
	await sign_up(other, member)
	await sign_up(page, mod)
	grant_moderator(mod)

	// The account menu offers the tools once the role is there.
	await page.goto('/')
	await page.getByRole('button', { name: 'Account menu' }).first().click()
	await page.getByRole('menuitem', { name: 'Moderation' }).click()
	await expect(page).toHaveURL(/\/mod$/)
	await expect(page.getByRole('heading', { name: 'Review requests' })).toBeVisible()

	// Suspend the member for a week, with a note they will see.
	await page.goto(`/mod/u/${member}`)
	await page.getByLabel('Rule broken').selectOption({ label: 'Spam' })
	await page.getByLabel('Length').selectOption({ label: '7 days' })
	await page.getByLabel('Note to the account (optional)').fill(`Too many links ${id}`)
	await page.getByRole('button', { name: 'Suspend', exact: true }).click()
	await expect(page.getByText(/^Suspended until/)).toBeVisible()

	// The member now sees only the suspension page, with the rule, the note and a way to ask.
	await other.goto('/')
	await expect(other).toHaveURL(/\/suspended$/)
	await expect(other.getByText('breaking this rule: Spam')).toBeVisible()
	await expect(other.getByText(`Too many links ${id}`)).toBeVisible()
	await expect(other.getByRole('link', { name: 'jiyuu.org@gmail.com' })).toBeVisible()
	await other.getByLabel('Your request').fill(`I only shared my notes ${id}`)
	await other.getByRole('button', { name: 'Send request' }).click()
	await expect(other.getByText('Your request was sent.')).toBeVisible()
	await other.reload()
	await expect(other.getByRole('button', { name: 'Send request' })).toHaveCount(0)

	// The request is in the queue; upholding it lifts the suspension.
	await page.goto('/mod')
	const request = page.locator('article', { hasText: `I only shared my notes ${id}` })
	await expect(request).toBeVisible()
	await request.getByRole('button', { name: 'Lift suspension' }).click()
	await expect(request).toHaveCount(0)

	await other.goto('/')
	await expect(other).toHaveURL(/\/$/)
	await other.context().close()
})

/** A 1×1 PNG. */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
)

/** Post `text` with one photo from the home composer; returns the post's id and the photo's URL. */
async function post_photo(page: Page, text: string, sensitive = false) {
	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer
		.locator('input[type="file"]')
		.setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }])
	await expect(composer.getByRole('button', { name: 'Remove' })).toHaveCount(1)
	if (sensitive) await composer.getByLabel('Mark media as sensitive').check()
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	const card = page.locator('article.post', { hasText: text }).first()
	await expect(card).toBeVisible()
	await card.getByText(text).click()
	await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/)
	const id = page.url().split('/p/')[1]
	const photo = await page.locator('main img[src^="/media/posts/"]').first().getAttribute('src')
	return { id, photo: photo! }
}

test('a removed post is gone for others; its author can ask for a review, which restores it @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const [author, reader] = await Promise.all(
		[0, 1].map(async () => (await browser.newContext()).newPage()),
	)
	await sign_up(author, `e2e_pa_${id}`)
	await sign_up(reader, `e2e_pr_${id}`)
	await sign_up(page, `e2e_pm_${id}`)
	grant_moderator(`e2e_pm_${id}`)

	const text = `Removable ${id}`
	const posted = await post_photo(author, text)
	expect((await reader.goto(`/p/${posted.id}`))?.status()).toBe(200)
	expect((await reader.request.get(posted.photo)).ok()).toBe(true)
	const places = [`/search?q=${encodeURIComponent(text)}`, `/u/e2e_pa_${id}`]
	for (const where of places) {
		await reader.goto(where)
		await expect(reader.locator('article.post', { hasText: text })).toHaveCount(1)
	}

	// The moderator finds the post's tools in its menu and removes it for spam.
	await page.goto(`/p/${posted.id}`)
	await page.getByRole('button', { name: 'More' }).first().click()
	await page.getByRole('menuitem', { name: 'Moderate' }).click()
	await expect(page).toHaveURL(new RegExp(`/mod/p/${posted.id}$`))
	await page.getByLabel('Rule broken').selectOption({ label: 'Spam' })
	await page.getByRole('button', { name: 'Remove', exact: true }).click()
	await expect(page.getByText('Removed · Spam · Strike')).toBeVisible()

	// Everyone else has lost it: the page, the photo, the search result, the profile.
	expect((await reader.goto(`/p/${posted.id}`))?.status()).toBe(404)
	expect((await reader.request.get(posted.photo)).status()).toBe(404)
	for (const where of places) {
		await reader.goto(where)
		await reader.waitForLoadState('networkidle')
		await expect(reader.locator('article.post', { hasText: text })).toHaveCount(0)
	}
	// A moderator following the post's own link lands on its moderator view instead of a 404.
	await page.goto(`/p/${posted.id}`)
	await expect(page).toHaveURL(new RegExp(`/mod/p/${posted.id}$`))

	// The author is told, sees why, and asks for a review.
	await author.goto('/notifications')
	await expect(
		author.getByText('A moderator removed your post for breaking a rule: Spam.'),
	).toBeVisible()
	await author.goto(`/p/${posted.id}`)
	await expect(author.getByRole('heading', { name: 'A moderator removed this post' })).toBeVisible()
	await author.getByLabel(/Ask for a review/).fill(`It was my own photo ${id}`)
	await author.getByRole('button', { name: 'Send request' }).click()
	await expect(author.getByText('Your request was sent.')).toBeVisible()

	// Restoring it brings it back for everyone.
	await page.goto('/mod')
	const request = page.locator('article', { hasText: `It was my own photo ${id}` })
	await request.getByRole('button', { name: 'Restore post' }).click()
	await expect(request).toHaveCount(0)
	expect((await reader.goto(`/p/${posted.id}`))?.status()).toBe(200)
	expect((await reader.request.get(posted.photo)).ok()).toBe(true)

	await author.context().close()
	await reader.context().close()
})

test('media marked sensitive waits behind a cover @writes', async ({ page, browser }) => {
	const id = unique()
	const reader = await (await browser.newContext()).newPage()
	await sign_up(page, `e2e_sa_${id}`)
	await sign_up(reader, `e2e_sr_${id}`)
	const posted = await post_photo(page, `Sensitive ${id}`, true)

	await reader.goto(`/p/${posted.id}`)
	await expect(reader.getByText('Sensitive content.')).toBeVisible()
	await expect(reader.locator('main img[src^="/media/posts/"]')).toHaveCount(0)
	await reader.getByRole('button', { name: 'Show', exact: true }).click()
	await expect(reader.locator('main img[src^="/media/posts/"]').first()).toBeVisible()
	await reader.context().close()
})

test('the hourly job deletes a removed post, with its photo, once its day has passed @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const author = await (await browser.newContext()).newPage()
	await sign_up(author, `e2e_ha_${id}`)
	await sign_up(page, `e2e_hm_${id}`)
	grant_moderator(`e2e_hm_${id}`)
	const posted = await post_photo(author, `Hourly ${id}`)

	await page.goto(`/mod/p/${posted.id}`)
	await page.getByLabel('Rule broken').selectOption({ label: 'Spam' })
	await page.getByRole('button', { name: 'Remove', exact: true }).click()
	await expect(page.getByText('Removed · Spam · Strike')).toBeVisible()

	// The job leaves it alone while the author can still ask for a review.
	const run = () => page.request.get('/__scheduled?cron=17+*+*+*+*')
	expect((await run()).ok()).toBe(true)
	expect((await author.goto(`/p/${posted.id}`))?.status()).toBe(200)

	age_removal(posted.id)
	expect((await run()).ok()).toBe(true)
	expect((await author.goto(`/p/${posted.id}`))?.status()).toBe(404)
	expect((await author.request.get(posted.photo)).status()).toBe(404)
	await author.context().close()
})

test('a burst of near-identical link posts restricts the account and asks a moderator @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const spammer = await (await browser.newContext()).newPage()
	await sign_up(spammer, `e2e_bs_${id}`)
	settle_account(`e2e_bs_${id}`)
	await sign_up(page, `e2e_bm_${id}`)
	grant_moderator(`e2e_bm_${id}`)

	// Each one differs in a number, so none is refused as a repeat; together they're one message.
	const composer = spammer.locator('form.inline')
	for (let i = 0; i < 10; i++) {
		await composer
			.getByLabel('Post text')
			.fill(
				`Free notes ${i} ${id} at https://notes${i}-${id}.example/a https://mirror-${id}.example/${i}`,
			)
		const stored = spammer.waitForResponse((response) => response.url().includes('/create_post'))
		await composer.getByRole('button', { name: 'Post', exact: true }).click()
		expect((await (await stored).json()).type).toBe('result')
	}

	const ran = await page.request.get('/__scheduled?cron=17+*+*+*+*')
	expect(ran.ok(), await ran.text()).toBe(true)

	// Restricted: back to a new account's limits, so ten posts an hour is the most.
	await composer.getByLabel('Post text').fill(`One more ${id}`)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(spammer.getByText('Your account can post 10 times an hour for now.')).toBeVisible()

	// The moderator sees why, and can lift it.
	await page.goto('/mod')
	const item = page.locator('article', { hasText: `@e2e_bs_${id}` })
	await expect(item.getByText(/Automatic checks: .*/)).toBeVisible()
	await page.goto(`/mod/u/e2e_bs_${id}`)
	await expect(page.getByText(/Restricted by its behaviour score/)).toBeVisible()
	await page.getByRole('button', { name: 'Lift restriction' }).click()
	await expect(page.getByRole('button', { name: 'Restrict' })).toBeVisible()
	await spammer.context().close()
})
