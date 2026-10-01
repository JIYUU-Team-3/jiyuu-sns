import { sql } from 'drizzle-orm'
import { profile, user } from './db/schema'

/**
 * The account's own photo is whatever Better Auth stored, and its `update-user` endpoint lets
 * the account set that to any URL. Shown as it is, every reader's browser would fetch a server
 * of the account's choosing, so only Google's photo host is ever shown.
 */
const GOOGLE_PHOTO = /^https:\/\/lh\d\.googleusercontent\.com\//

export const account_image = (url: string | null | undefined) =>
	url && GOOGLE_PHOTO.test(url) ? url : undefined

/** The avatar to show for the joined `profile` and `user`: an upload, else the Google photo. */
export const shown_image = sql<
	string | null
>`coalesce(${profile.avatarUrl}, case when ${user.image} like 'https://lh_.googleusercontent.com/%' then ${user.image} end)`
