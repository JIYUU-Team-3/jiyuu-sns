import { image_problem, type ImageKind, type ImageProblem } from '#lib/media'

export const NAME_MAX = 50
export const HANDLE_MAX = 20
export const BIO_MAX = 160

const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/

/** Handles kept for Jiyuu itself. Checked here until the backend owns handle availability. */
const RESERVED_HANDLES = new Set([
	...['admin', 'administrator', 'jiyuu', 'jiyuu_official', 'jiyuu_support', 'jiyuu.official'],
	// The moderator's handle. Its holder keeps it; see `current` below.
	'jiyuu_org',
	...['support', 'help', 'official', 'staff', 'team', 'moderator', 'mod', 'security', 'system'],
	...['root', 'everyone', 'here'],
])

/** `locked`: a moderator's handle, which can't change, so it never comes free for someone else. */
export type HandleProblem = 'format' | 'taken' | 'locked'

/**
 * Why a proposed handle can't be used, or undefined when it looks fine. `current` is the
 * account's own handle: keeping it is always fine, even when it's reserved, and with `locked`
 * nothing else is.
 */
export function handle_problem(
	handle: string,
	current?: string,
	locked = false,
): HandleProblem | undefined {
	if (current !== undefined && handle === current) return undefined
	if (locked) return 'locked'
	if (!HANDLE_PATTERN.test(handle)) return 'format'
	if (RESERVED_HANDLES.has(handle)) return 'taken'
	return undefined
}

export type ProfileDraft = { name: string; handle: string; bio: string }

export type ProfileErrors = {
	name?: 'required'
	handle?: HandleProblem
	avatar?: ImageProblem
	banner?: ImageProblem
}

/** The optional avatar and banner a profile form sends. */
export type ProfileImages = Partial<Record<ImageKind, File>>

/** Field problems in a submitted profile; an empty object means it can be saved. */
export function profile_errors(
	draft: ProfileDraft,
	current?: string,
	locked = false,
): ProfileErrors {
	const errors: ProfileErrors = {}
	if (!draft.name) errors.name = 'required'
	const handle = handle_problem(draft.handle, current, locked)
	if (handle) errors.handle = handle
	return errors
}

/** Problems with the picked images; an empty object when there are none. */
export async function image_errors(images: ProfileImages): Promise<ProfileErrors> {
	const errors: ProfileErrors = {}
	for (const kind of ['avatar', 'banner'] as const) {
		const file = images[kind]
		const problem = file && (await image_problem(file, kind))
		if (problem) errors[kind] = problem
	}
	return errors
}

/**
 * Control characters, and the bidi overrides and isolates that reorder the text around them: in a
 * name they let one account be drawn as another's, or flip the text of the row it sits in.
 * Zero-width joiners stay, since emoji and Khmer are written with them.
 */
const INVISIBLE = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu

/** Text without those characters. A bio keeps its line breaks; a name is one line. */
export const visible_text = (text: string, keep_breaks = false) =>
	text.replace(INVISIBLE, (char) => (keep_breaks && char === '\n' ? char : ' '))

/** Read the onboarding form, cleaned, trimmed and clipped to each field's limit. */
export function read_profile(data: FormData): ProfileDraft {
	const field = (key: string, max: number, keep_breaks = false) =>
		visible_text(String(data.get(key) ?? ''), keep_breaks)
			.trim()
			.slice(0, max)
	return {
		name: field('name', NAME_MAX),
		handle: field('handle', HANDLE_MAX),
		bio: field('bio', BIO_MAX, true),
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
