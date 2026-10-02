import { expect, test, type Browser, type Page } from '@playwright/test'
import { sign_up } from '../../sign-up'

const unique = () => crypto.randomUUID().slice(0, 8)

async function person(browser: Browser, handle: string) {
	const page = await (await browser.newContext()).newPage()
	await sign_up(page, handle)
	return page
}

async function post(page: Page, text: string) {
	await page.goto('/')
	await page.waitForLoadState('networkidle')
	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(text)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.locator('article.post', { hasText: text })).toBeVisible()
}

async function open_profile(page: Page, handle: string) {
	await page.goto(`/u/${handle}`)
	await page.waitForLoadState('networkidle')
}

test('blocking hides both people from each other until unblocked @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const alice = `e2e_pa_${id}`
	const bob = `e2e_pb_${id}`
	const bob_page = await person(browser, bob)
	await post(bob_page, `Bob writes ${id}`)
	await sign_up(page, alice)

	await open_profile(page, bob)
	await expect(page.getByText(`Bob writes ${id}`)).toBeVisible()
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await page.getByRole('menuitem', { name: `Block @${bob}` }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Block', exact: true }).click()
	await expect(page.getByText(`You blocked @${bob}`)).toBeVisible()
	await expect(page.getByText(`Bob writes ${id}`)).toHaveCount(0)

	await open_profile(bob_page, alice)
	await expect(bob_page.getByText(`@${alice} blocked you`)).toBeVisible()
	await expect(
		bob_page.locator('main').getByRole('button', { name: `Follow @${alice}` }),
	).toHaveCount(0)

	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	const blocked = page.locator('section', { hasText: 'Blocked accounts' })
	await expect(blocked.getByText(`@${bob}`)).toBeVisible()
	await blocked.getByRole('button', { name: `Unblock @${bob}` }).click()
	await expect(blocked.getByText('You haven’t blocked anyone.')).toBeVisible()

	await open_profile(page, bob)
	await expect(page.getByText(`Bob writes ${id}`)).toBeVisible()
	await bob_page.context().close()
})

test('a muted word hides matching posts from search @writes', async ({ page, browser }) => {
	const id = unique()
	const tag = `e2emute${id}`
	const bob_page = await person(browser, `e2e_mb_${id}`)
	await post(bob_page, `About #${tag} today`)
	await sign_up(page, `e2e_ma_${id}`)

	await page.goto(`/search?q=%23${tag}`)
	await expect(page.locator('article.post', { hasText: tag })).toBeVisible()

	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	await page.getByLabel('Word, phrase or #hashtag').fill(`#${tag.toUpperCase()}`)
	const saved = page.waitForResponse((response) => response.url().includes('/mute_term'))
	await page.getByRole('button', { name: 'Mute', exact: true }).click()
	await saved
	await expect(page.getByRole('listitem').getByText(`#${tag}`, { exact: true })).toBeVisible()

	await page.goto(`/search?q=%23${tag}`)
	await expect(page.locator('article.post', { hasText: tag })).toHaveCount(0)
	await bob_page.context().close()
})

test('a private account shows its posts only to approved followers @writes', async ({
	page,
	browser,
}) => {
	const id = unique()
	const alice = `e2e_qa_${id}`
	const bob = `e2e_qb_${id}`
	const bob_page = await person(browser, bob)
	await sign_up(page, alice)

	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	const toggle = page.getByRole('switch', { name: /Private account/ })
	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-checked', 'true')
	await post(page, `Only for friends ${id}`)

	await open_profile(bob_page, alice)
	await expect(bob_page.getByText('These posts are protected')).toBeVisible()
	await bob_page
		.locator('main')
		.getByRole('button', { name: `Follow @${alice}` })
		.click()
	await expect(
		bob_page.locator('main').getByRole('button', { name: `Cancel follow request to @${alice}` }),
	).toHaveText('Requested')

	await page.goto('/notifications')
	await expect(page.getByText(`${bob} asked to follow you`)).toBeVisible()
	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'Approve' }).click()
	await expect(page.getByText('No pending requests.')).toBeVisible()

	await open_profile(bob_page, alice)
	await expect(bob_page.getByText(`Only for friends ${id}`)).toBeVisible()

	const carol_page = await person(browser, `e2e_qc_${id}`)
	await open_profile(carol_page, alice)
	await carol_page
		.locator('main')
		.getByRole('button', { name: `Follow @${alice}` })
		.click()
	await expect(
		carol_page.locator('main').getByRole('button', { name: `Cancel follow request to @${alice}` }),
	).toBeVisible()
	await page.goto('/settings/privacy')
	await page.waitForLoadState('networkidle')
	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-checked', 'false')
	await open_profile(carol_page, alice)
	await expect(
		carol_page.locator('main').getByRole('button', { name: `Unfollow @${alice}` }),
	).toBeVisible()

	await bob_page.context().close()
	await carol_page.context().close()
})

test('only people a post mentions can reply to it @writes', async ({ page, browser }) => {
	const id = unique()
	const alice = `e2e_ra_${id}`
	const bob = `e2e_rb_${id}`
	const bob_page = await person(browser, bob)
	const carol_page = await person(browser, `e2e_rc_${id}`)
	await sign_up(page, alice)

	const composer = page.locator('form.inline')
	await composer.getByLabel('Post text').fill(`Hi @${bob} ${id}`)
	await composer.getByRole('button', { name: 'Everyone can reply' }).click()
	await page.getByRole('menuitemradio', { name: 'Only people you mention can reply' }).click()
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	const card = page.locator('article.post', { hasText: `Hi @${bob} ${id}` })
	await expect(card).toBeVisible()
	await card.locator('a[href*="/p/"]').first().click()
	await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/)
	const url = new URL(page.url()).pathname

	await carol_page.goto(url)
	await expect(carol_page.getByText(`Only people @${alice} mentioned can reply`)).toBeVisible()
	await expect(carol_page.locator('form.reply')).toHaveCount(0)

	await bob_page.goto(url)
	await expect(bob_page.locator('form.reply')).toBeVisible()
	await bob_page.context().close()
	await carol_page.context().close()
})

test('a post can be reported @writes', async ({ page, browser }) => {
	const id = unique()
	const bob = `e2e_tb_${id}`
	const bob_page = await person(browser, bob)
	await post(bob_page, `Report me ${id}`)
	await sign_up(page, `e2e_ta_${id}`)

	await open_profile(page, bob)
	const card = page.locator('article.post', { hasText: `Report me ${id}` })
	await card.getByRole('button', { name: 'More options' }).click()
	await page.getByRole('menuitem', { name: 'Report post' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Spam').check()
	await dialog.getByRole('button', { name: 'Send report' }).click()
	await expect(page.getByText('Thanks. Your report was sent.')).toBeVisible()
	await bob_page.context().close()
})
