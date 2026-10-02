import { m } from '#lib/paraglide/messages.js'
import { toast } from '#lib/ui/toasts.svelte'
import { MEDIA_MAX } from '../rules'
import type { Draft } from './draft.svelte'

/** Pasting and the picker report skipped files the same way. */
export async function pick_files(draft: Draft, files: File[]) {
	const { skipped, over_limit } = await draft.add_files(files)
	if (over_limit) toast.show(m.composer_media_limit({ count: MEDIA_MAX }))
	else if (skipped.includes('size')) toast.show(m.composer_media_too_big())
	else if (skipped.includes('duration')) toast.show(m.composer_video_too_long())
	else if (skipped.includes('type')) toast.show(m.composer_media_type())
}
