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

/** Lowercase ASCII words of some text, with accents dropped, e.g. `José Núñez` → `jose`, `nunez`. */
const ascii_words = (text: string) =>
	text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean)

/**
 * A handle from as many whole words as fit, or undefined when they don't make a usable one.
 * Only a first word that is too long on its own gets cut.
 */
function handle_from(words: string[]) {
	let handle = (words[0] ?? '').slice(0, HANDLE_MAX)
	for (const word of words.slice(1)) {
		if (handle.length + 1 + word.length > HANDLE_MAX) break
		handle += `_${word}`
	}
	return handle_problem(handle) ? undefined : handle
}

/**
 * A starting handle from the Google account: the name's words joined by underscores, e.g.
 * `Mika Tanaka` → `mika_tanaka`. Names without Latin letters fall back to the email's local
 * part. Empty when neither gives a usable handle. Availability is still unchecked.
 */
export function suggest_handle(name: string, email: string) {
	const local_part = email.split('@')[0] ?? ''
	return handle_from(ascii_words(name)) ?? handle_from(ascii_words(local_part)) ?? ''
}

// Shared with the app's avatars, so a person keeps one colour and one set of initials everywhere.
export { avatar_hue, initials } from '#lib/ui/Avatar.svelte'
