export type Role = 'lead' | 'backend' | 'design' | 'devops' | 'testing'

export type Member = {
	name: string
	/** Jiyuu handle. */
	jiyuu: string
	/** GitHub username. */
	handle: string
	/** GitHub display name, when the member has set one. */
	github_name?: string
	role: Role
	hue: number
}

export const TEAM: Member[] = [
	{ name: 'Sathya', jiyuu: 'sathya', handle: 'Jerry12sir', role: 'lead', hue: 210 },
	{
		name: 'Tithya',
		jiyuu: 'tithya',
		handle: 'Uteytithya',
		github_name: 'Tithya',
		role: 'backend',
		hue: 350,
	},
	{
		name: 'Manut',
		jiyuu: 'manut',
		handle: 'Hout-Manut',
		github_name: 'Manut',
		role: 'design',
		hue: 145,
	},
	{ name: 'Porcheng', jiyuu: 'porcheng', handle: 'Porchhenng', role: 'devops', hue: 30 },
	{
		name: 'Visal',
		jiyuu: 'visal',
		handle: 'salxz696969',
		github_name: 'Sao Visal',
		role: 'testing',
		hue: 270,
	},
]
