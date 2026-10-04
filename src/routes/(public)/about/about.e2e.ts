import { expect, test } from '@playwright/test'

/**
 * The about page is public: without a session it shows the team as `team.ts` has it, with the
 * snapshot photos, and every profile link asks the visitor to sign in.
 */
test('shows the team snapshot to visitors who are not signed in', async ({ page }) => {
	await page.goto('/about')
	const team = page.getByRole('region', { name: 'Who to follow' })
	await expect(team.getByRole('listitem')).toHaveCount(5)
	await expect(team.getByText('@marut')).toBeVisible()
	await expect(team.locator('img.photo')).toHaveCount(5)
	await expect(
		team.getByRole('link', { name: 'Marut on Jiyuu (sign in to view)' }),
	).toHaveAttribute('title', 'Sign in to view')
})
