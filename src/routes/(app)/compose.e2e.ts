import { expect, test } from '@playwright/test'
import { sign_up } from './sign-up'

test('the composer suggests people to mention and colours tags and mentions @writes', async ({
	page,
	browser,
}) => {
	const id = crypto.randomUUID().slice(0, 8)
	const friend = `e2e_m_${id}`
	const me = `e2e_c_${id}`

	const friend_context = await browser.newContext()
	await sign_up(await friend_context.newPage(), friend)
	await friend_context.close()
	await sign_up(page, me)

	const composer = page.locator('form.inline')
	const box = composer.getByLabel('Post text')
	await expect(composer.getByRole('button', { name: 'Post', exact: true })).toBeDisabled()
	await box.pressSequentially(`Hello @${friend.slice(0, -3)}`)

	// Pick the suggestion with the keyboard; the handle is filled in with a space after it.
	const option = page.getByRole('option', { name: new RegExp(`@${friend}`) })
	await expect(option).toBeVisible()
	await box.press('ArrowDown')
	while ((await option.getAttribute('aria-selected')) !== 'true') await box.press('ArrowDown')
	await box.press('Enter')
	await expect(box).toHaveValue(`Hello @${friend} `)

	// Tags and mentions show in the accent colour while typing.
	await box.pressSequentially(`#e2e${id}`)
	await expect(composer.locator('.mirror .accent')).toHaveText([`@${friend}`, `#e2e${id}`])

	await composer.getByRole('button', { name: 'Post', exact: true }).click()
	await expect(page.getByText('Your post was sent.')).toBeVisible()
	const card = page.locator('article.post', { hasText: `#e2e${id}` })
	await expect(card.getByRole('link', { name: `@${friend}` })).toHaveAttribute(
		'href',
		new RegExp(`/u/${friend}$`),
	)
})
