import { sql, type SQLWrapper } from 'drizzle-orm'
import { profile, user } from './db/schema'

/**
 * The account's own photo is whatever Better Auth stored, and its `update-user` endpoint lets
 * the account set that to any URL. Shown as it is, every reader's browser would fetch a server
 * of the account's choosing, so only Google's photo host is ever shown.
 */
const GOOGLE_PHOTO = /^https:\/\/lh\d\.googleusercontent\.com\//

export const account_image = (url: string | null | undefined) =>
	url && GOOGLE_PHOTO.test(url) ? url : undefined

/** The avatar to show for a profile's upload and its account's photo: the upload, else Google's. */
export const image_of = (avatar: SQLWrapper, image: SQLWrapper) =>
	sql<
		string | null
	>`coalesce(${avatar}, case when ${image} like 'https://lh_.googleusercontent.com/%' then ${image} end)`

/** The avatar to show for the joined `profile` and `user`. */
export const shown_image = image_of(profile.avatarUrl, user.image)
