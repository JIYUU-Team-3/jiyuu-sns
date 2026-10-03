import type { ProfileView } from './types'

export const protected_from = (profile: ProfileView) =>
	profile.private && !profile.followed && !profile.mine

export const lists_open = (profile: ProfileView) =>
	!profile.blocked && !profile.blocks_you && !protected_from(profile)
