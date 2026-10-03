/** Who may see part of a profile: anyone, the account's followers, or only the account. */
export const AUDIENCES = ['everyone', 'followers', 'only_me'] as const
export type Audience = (typeof AUDIENCES)[number]

/** X's limit for a profile's location. */
export const LOCATION_MAX = 30
/** The youngest anyone may say they are, as on X. */
export const MIN_AGE = 13
/** The oldest year the birthday picker offers. */
export const FIRST_YEAR = 1900

export type BirthdayProblem = 'invalid' | 'too_young'

/** What a profile's viewer may see of a birthday: the month and day, the year too, or neither. */
export type Birthday = { month: number; day: number; year?: number }

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** A `YYYY-MM-DD` date's parts, or undefined when it isn't a real date, such as 2001-02-29. */
export function date_parts(date: string) {
	const match = DATE.exec(date)
	if (!match) return undefined
	const [year, month, day] = match.slice(1).map(Number)
	const check = new Date(Date.UTC(year, month - 1, day))
	if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return undefined
	return { year, month, day }
}

/** `YYYY-MM-DD` from picked parts, or undefined unless all three are picked. */
export function join_date(year: string, month: string, day: string) {
	if (!year || !month || !day) return undefined
	return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** Why a birth date can't be saved: not a real past date, or under `MIN_AGE` on `today`. */
export function birthday_problem(date: string, today = new Date()): BirthdayProblem | undefined {
	const parts = date_parts(date)
	if (!parts || parts.year < FIRST_YEAR) return 'invalid'
	const now = {
		year: today.getUTCFullYear(),
		month: today.getUTCMonth() + 1,
		day: today.getUTCDate(),
	}
	const had_birthday =
		now.month > parts.month || (now.month === parts.month && now.day >= parts.day)
	const age = now.year - parts.year - (had_birthday ? 0 : 1)
	if (age < 0) return 'invalid'
	return age < MIN_AGE ? 'too_young' : undefined
}

/** Whether `audience` lets a viewer in, given whether it's the account itself or a follower. */
export function lets_in(audience: Audience, viewer: { mine: boolean; follower: boolean }) {
	return viewer.mine || audience === 'everyone' || (audience === 'followers' && viewer.follower)
}

/** The part of a birthday a viewer may see, or undefined when the month and day are hidden. */
export function shown_birthday(
	date: string | null | undefined,
	audiences: { day: Audience; year: Audience },
	viewer: { mine: boolean; follower: boolean },
): Birthday | undefined {
	const parts = date ? date_parts(date) : undefined
	if (!parts || !lets_in(audiences.day, viewer)) return undefined
	return {
		month: parts.month,
		day: parts.day,
		...(lets_in(audiences.year, viewer) && { year: parts.year }),
	}
}

/** Whether `birthday` falls on `today` in the viewer's own calendar. */
export const is_birthday = (birthday: Birthday | undefined, today = new Date()) =>
	!!birthday && birthday.month === today.getMonth() + 1 && birthday.day === today.getDate()
