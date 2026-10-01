import type { PageServerLoad } from './$types'

/** The app layout already requires a session; the page only adds the account's email. */
export const load: PageServerLoad = ({ locals }) => ({ email: locals.user?.email })
