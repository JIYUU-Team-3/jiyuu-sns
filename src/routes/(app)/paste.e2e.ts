import { expect, test, type Locator } from '@playwright/test'
import { follow } from './follow'
import { sign_up } from './sign-up'

// A 2×1 PNG, so the upload has real image bytes and a known shape.
const PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQv8BD/kD/YURmXYAAAAASUVORK5CYII='

/** Paste a screenshot, the way the browser hands one over: as a file on the clipboard. */
async function paste_image(field: Locator) {
	await field.evaluate((element, base64) => {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
		const clipboardData = new DataTransfer()
		clipboardData.items.add(new File([bytes], 'image.png', { type: 'image/png' }))
		const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
		// Firefox ignores clipboardData in the constructor (Mozilla bug 2027025).
		Object.defineProperty(event, 'clipboardData', { value: clipboardData })
		element.dispatchEvent(event)
	}, PNG)
}

/** Whether a paste of plain text is left to the browser. */
function paste_text(field: Locator) {
	return field.evaluate((element) => {
		const clipboardData = new DataTransfer()
		clipboardData.setData('text/plain', 'ordinary text')
		const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true })
		Object.defineProperty(event, 'clipboardData', { value: clipboardData })
		return element.dispatchEvent(event)
	})
}

test('paste a screenshot into a post @writes', async ({ page }) => {
	const id = crypto.randomUUID().slice(0, 8)
	await sign_up(page, `e2e_paste_${id}`)
	const composer = page.locator('form.inline')
	const field = composer.getByLabel('Post text')
	const post_button = composer.getByRole('button', { name: 'Post', exact: true })
	const body = `Pasted ${id}`

	await field.fill(body)
	expect(await paste_text(field)).toBe(true)
	await expect(composer.getByRole('button', { name: 'Remove' })).toHaveCount(0)

	await paste_image(field)
	await expect(composer.getByRole('button', { name: 'Remove' })).toHaveCount(1)
	await expect(field).toHaveValue(body)
	await expect(post_button).toBeEnabled()
	await post_button.click()

	const card = page.locator('article.post', { hasText: body }).first()
	await expect(card.locator('.single img')).toBeVisible()
})

test('paste a screenshot into a message @writes', async ({ page, browser }) => {
	const id = crypto.randomUUID().slice(0, 8)
	const alice = `e2e_psa_${id}`
	const bob = `e2e_psb_${id}`
	const bob_context = await browser.newContext()
	try {
		const bob_page = await bob_context.newPage()
		await sign_up(page, alice)
		await sign_up(bob_page, bob)
		// New accounts can only start a chat with someone who follows them.
		await follow(page, bob)

		await bob_page.goto(`/u/${alice}`)
		await bob_page.waitForLoadState('networkidle')
		await bob_page.getByRole('button', { name: `Message @${alice}` }).click()
		await expect(bob_page).toHaveURL(/\/messages\/[\w-]+$/)
		const field = bob_page.getByLabel('Message', { exact: true })
		const send = bob_page.getByRole('button', { name: 'Send' })

		expect(await paste_text(field)).toBe(true)
		await expect(bob_page.locator('.attach')).toHaveCount(0)

		await paste_image(field)
		await expect(bob_page.locator('.attach img')).toBeVisible()
		await expect(send).toBeEnabled()
		const stored = bob_page.waitForResponse((response) => response.url().includes('/send_message'))
		await send.click()
		await stored
		await expect(bob_page.locator('.msg .media img')).toBeVisible()
	} finally {
		await bob_context.close()
	}
})
