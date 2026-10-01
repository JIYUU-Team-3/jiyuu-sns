import { expect, test } from '@playwright/test'
import { sign_up } from '../sign-up'
import { grant_moderator } from './grant'

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
