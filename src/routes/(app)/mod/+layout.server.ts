import { require_moderator } from '#lib/server/moderation/guard'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => {
	require_moderator(locals)
}
