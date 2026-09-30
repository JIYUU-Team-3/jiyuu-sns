import { expect, test } from '@playwright/test'
import { sign_up } from '../sign-up'

test('hashtags link to search, and search finds posts, people and tags @writes', async ({
	page,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const handle = `e2e_s_${id}`
	const tag = `e2etag${id}`
	await sign_up(page, handle)

	const composer = page.locator('form.inline')
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await composer.getByLabel('Post text').fill(`Trying #${tag.toUpperCase()} today`)
	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	const card = page.locator('article.post', { hasText: `#${tag.toUpperCase()}` })
	await expect(card).toBeVisible()

	// The tag is a link to its search, matched without regard to case.
	await card.getByRole('link', { name: `#${tag.toUpperCase()}` }).click()
	await expect(page).toHaveURL(new RegExp(`/search\\?q=%23${tag}$`))
	await expect(page.locator('article.post', { hasText: `#${tag.toUpperCase()}` })).toBeVisible()

	await page.getByRole('tab', { name: 'Tags' }).click()
	await expect(page).toHaveURL(/tab=tags/)
	await expect(page.getByRole('link', { name: new RegExp(`#${tag}`) })).toBeVisible()

	// People search by handle, typed into the search box.
	const box = page.getByRole('combobox', { name: 'Search' })
	await box.fill(`@${handle}`)
	await box.press('Enter')
	await page.getByRole('tab', { name: 'People' }).click()
	await expect(page.getByRole('link', { name: handle }).first()).toBeVisible()

	// Typing suggests the closest people; picking one opens their profile.
	await page.goto('/explore')
	await page.waitForLoadState('networkidle')
	const explore_box = page.getByRole('combobox', { name: 'Search' })
	await explore_box.pressSequentially(handle.slice(0, -2))
	const suggestion = page.getByRole('option', { name: new RegExp(`@${handle}`) })
	await expect(suggestion).toBeVisible()
	await suggestion.click()
	await expect(page).toHaveURL(new RegExp(`/u/${handle}$`))

	// Top leads with the closest people, like X, even with a typo in the query.
	const typo = handle.slice(0, 4) + handle[5] + handle[4] + handle.slice(6)
	await page.goto(`/search?q=${typo}`)
	await page.waitForLoadState('networkidle')
	const people = page.locator('section.people')
	await expect(people.getByText(`@${handle}`)).toBeVisible()
	await people.getByRole('button', { name: 'View all' }).click()
	await expect(page).toHaveURL(/tab=people/)

	// A search with no matches says so.
	await page.goto(`/search?q=nothing-matches-${id}`)
	await expect(page.getByText(`No results for “nothing-matches-${id}”`)).toBeVisible()
})
