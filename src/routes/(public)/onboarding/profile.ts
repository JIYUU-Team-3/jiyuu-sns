export const NAME_MAX = 50
export const HANDLE_MAX = 20
export const BIO_MAX = 160

const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/

/** Handles kept for Jiyuu itself. Checked here until the backend owns handle availability. */
const RESERVED_HANDLES = new Set(['admin', 'jiyuu', 'support'])

export type HandleProblem = 'format' | 'taken'

/** Why a proposed handle can't be used, or undefined when it looks fine. */
export function handle_problem(handle: string): HandleProblem | undefined {
	if (!HANDLE_PATTERN.test(handle)) return 'format'
	if (RESERVED_HANDLES.has(handle)) return 'taken'
	return undefined
}

export type ProfileDraft = { name: string; handle: string; bio: string }

export type ProfileErrors = { name?: 'required'; handle?: HandleProblem }

/** Field problems in a submitted profile; an empty object means it can be saved. */
export function profile_errors(draft: ProfileDraft): ProfileErrors {
	const errors: ProfileErrors = {}
	if (!draft.name) errors.name = 'required'
	const handle = handle_problem(draft.handle)
	if (handle) errors.handle = handle
	return errors
}

/** Read the onboarding form, trimmed and clipped to each field's limit. */
export function read_profile(data: FormData): ProfileDraft {
	const field = (key: string, max: number) =>
		String(data.get(key) ?? '')
			.trim()
			.slice(0, max)
	return {
		name: field('name', NAME_MAX),
		handle: field('handle', HANDLE_MAX),
		bio: field('bio', BIO_MAX),
	}
}

/** A stable avatar hue for someone without a photo, so their initials keep one colour. */
export function avatar_hue(seed: string) {
	let hash = 0
	for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
	return Math.abs(hash) % 360
}

/** Up to two initials from a display name, e.g. `Mika Tanaka` → `MT`. */
export const initials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => [...word][0])
		.join('')
		.toUpperCase()
