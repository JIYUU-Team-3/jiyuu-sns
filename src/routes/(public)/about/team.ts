import marut from './team/marut.webp'
import por_chheng from './team/por_chheng.webp'
import sao_suck from './team/sao_suck.webp'
import sathya from './team/sathya.webp'
import tsuya from './team/tsuya.webp'

export type Member = {
	name: string
	/** Jiyuu handle. */
	jiyuu: string
	/** GitHub username. */
	handle: string
	/** GitHub display name, when the member has set one. */
	github_name?: string
	/** A snapshot of the member's Jiyuu photo, for visitors who aren't signed in. */
	pfp?: string
	hue: number
}

/** A member's profile as it is now, which only signed-in visitors get. */
export type LiveProfile = { handle: string; name: string; image?: string }

export const TEAM: Member[] = [
	{ name: 'Sathya', jiyuu: 'sathya', handle: 'Jerry12sir', pfp: sathya, hue: 210 },
	{
		name: 'Tithya',
		jiyuu: 'tsuya',
		handle: 'Uteytithya',
		github_name: 'Tithya',
		pfp: tsuya,
		hue: 350,
	},
	{
		name: 'Manut',
		jiyuu: 'marut',
		handle: 'Hout-Manut',
		github_name: 'Manut',
		pfp: marut,
		hue: 145,
	},
	{ name: 'Por Chheng', jiyuu: 'por_chheng', handle: 'Porchhenng', pfp: por_chheng, hue: 30 },
	{
		name: 'Sao Visal',
		jiyuu: 'sao_suck',
		handle: 'salxz696969',
		github_name: 'Sao Visal',
		pfp: sao_suck,
		hue: 270,
	},
]

/** The team with each member's current name and photo where there is a live profile. */
export const with_live = (team: Member[], live: LiveProfile[]): Member[] =>
	team.map((member) => {
		const now = live.find((profile) => profile.handle === member.jiyuu)
		return now ? { ...member, name: now.name, pfp: now.image } : member
	})
