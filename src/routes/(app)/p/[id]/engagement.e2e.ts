import { expect, test, type Page } from '@playwright/test'
import { sign_up } from '../../sign-up'

const unique = () => crypto.randomUUID().slice(0, 8)

/** Post from Home's inline composer and open the new post's page; returns its URL. */
async function post_and_open(page: Page, text: string) {
	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await page.getByRole('link', { name: 'View' }).click()
	await expect(page.locator('article.focus')).toContainText(text)
	return page.url()
}

/** The focus post's action bar, once the page can act on clicks. */
async function focus_actions(page: Page, url: string) {
	await page.goto(url)
	// A click before hydration does nothing.
	await page.waitForLoadState('networkidle')
	return page.locator('article.focus .actions')
}

test('repost a post onto your timelines and tell its author @writes', async ({ page, browser }) => {
	const id = unique()
	const alice = `e2e_ra_${id}`
	const bob = `e2e_rb_${id}`
	const text = `Worth reposting ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	const url = await post_and_open(bob_page, text)

	await sign_up(page, alice)
	const actions = await focus_actions(page, url)
	await actions.getByRole('button', { name: 'Repost' }).click()
	// The button flips before the server has it; wait until it's stored.
	const stored = page.waitForResponse((response) => response.url().includes('/set_repost'))
	await page.getByRole('menuitem', { name: 'Repost' }).click()
	await expect(page.getByText('Reposted', { exact: true })).toBeVisible()
	await stored
	await expect(actions.getByRole('button', { name: 'Reposted' })).toBeVisible()
	await expect(page.locator('article.focus .fstats')).toContainText('1 Repost')

	// On Alice's profile and in her Following feed, under a "You reposted" line.
	await page.goto(`/u/${alice}`)
	const entry = page.locator('article.post', { hasText: text })
	await expect(entry).toContainText('You reposted')
	await page.goto('/')
	await page.waitForLoadState('networkidle')
	await page.getByRole('tab', { name: 'Following' }).click()
	await expect(page.locator('article.post', { hasText: text })).toContainText('You reposted')

	await bob_page.goto('/notifications')
	await expect(bob_page.getByText(`${alice} reposted your post`)).toBeVisible()

	// Undoing it takes it off her profile.
	const again = await focus_actions(page, url)
	await again.getByRole('button', { name: 'Reposted' }).click()
	const removed = page.waitForResponse((response) => response.url().includes('/set_repost'))
	await page.getByRole('menuitem', { name: 'Undo repost' }).click()
	await expect(page.getByText('Repost removed')).toBeVisible()
	await removed
	await page.goto(`/u/${alice}`)
	await expect(page.locator('article.post', { hasText: text })).toHaveCount(0)
	await bob_context.close()
})

test('quote a post with a comment @writes', async ({ page, browser }) => {
	const id = unique()
	const alice = `e2e_qa_${id}`
	const bob = `e2e_qb_${id}`
	const text = `Quote me ${id}`
	const comment = `My take on it ${id}`

	const bob_context = await browser.newContext()
	const bob_page = await bob_context.newPage()
	await sign_up(bob_page, bob)
	const url = await post_and_open(bob_page, text)

	await sign_up(page, alice)
	const actions = await focus_actions(page, url)
	await actions.getByRole('button', { name: 'Repost' }).click()
	await page.getByRole('menuitem', { name: 'Quote' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.locator('.quote')).toContainText(text)
	await dialog.getByLabel('Post text').fill(comment)
	await dialog.getByRole('button', { name: 'Post', exact: true }).click()
	await page.getByRole('link', { name: 'View' }).click()

	const focus = page.locator('article.focus')
	await expect(focus).toContainText(comment)
	await focus.locator('a.quote', { hasText: text }).click()
	await expect(page.locator('article.focus .fstats')).toContainText('1 Quote')

	await bob_page.goto('/notifications')
	await expect(bob_page.locator('article.post', { hasText: comment })).toContainText(text)
	await bob_context.close()
})

test('bookmarks are saved privately and can be removed @writes', async ({ page, playwright }) => {
	const id = unique()
	const text = `Save for later ${id}`
	await sign_up(page, `e2e_bm_${id}`)
	const url = await post_and_open(page, text)

	const actions = await focus_actions(page, url)
	const stored = page.waitForResponse((response) => response.url().includes('/set_bookmark'))
	await actions.getByRole('button', { name: 'Bookmark', exact: true }).click()
	await expect(page.getByText('Added to Bookmarks')).toBeVisible()
	await stored

	// The bookmark already sent the list back; a fresh tab's visit is what asks for it.
	await page.getByRole('link', { name: 'View' }).click()
	const card = page.locator('article.post', { hasText: text })
	await expect(card).toBeVisible()
	await page.goto('/')
	await page.waitForLoadState('networkidle')
	const listed = page.waitForRequest((request) => request.url().includes('/get_bookmarks'))
	await page.getByRole('link', { name: 'Bookmarks' }).click()
	await expect(card).toBeVisible()

	// Nobody signed out gets at them.
	const anonymous = await playwright.request.newContext()
	const refused = await (await anonymous.get((await listed).url())).json()
	expect(refused).toMatchObject({ type: 'error', error: { status: 401 } })
	await anonymous.dispose()

	const removed = page.waitForResponse((response) => response.url().includes('/set_bookmark'))
	await card.getByRole('button', { name: 'Bookmarked' }).click()
	await expect(page.getByText('Removed from Bookmarks')).toBeVisible()
	await expect(page.getByText('Save posts for later')).toBeVisible()
	await removed
	await page.reload()
	await expect(page.getByText('Save posts for later')).toBeVisible()
})
