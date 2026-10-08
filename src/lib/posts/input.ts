import * as v from 'valibot'
import { clean_text } from './clean'

/**
 * A post's text as the server takes it, from the composer or the API. The real limit is checked
 * in graphemes by `post_problem`; this only bounds the payload. Bidi overrides and stacked marks
 * are taken out first, as names and bios already are.
 */
export const PostText = v.pipe(
	v.string(),
	v.maxLength(8000),
	v.transform(clean_text),
	v.trim(),
	v.maxLength(4000),
)
