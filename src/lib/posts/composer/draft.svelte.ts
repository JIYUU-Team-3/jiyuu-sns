import {
	draft_problem,
	has_duplicates,
	MEDIA_MAX,
	POLL_MAX_OPTIONS,
	POLL_MIN_OPTIONS,
	post_problem,
	type PollDays,
} from '../rules'
import type { PostContent } from '../state.svelte'
import { is_upload, type Gif, type Media, type MediaKind } from '../types'
import type { CropBox } from './crop-box'
import {
	discard_upload,
	measure,
	probe_video,
	upload_kind,
	upload_media,
	upload_problem,
	video_problem,
	type UploadProblem,
	type VideoProbe,
} from './upload'

export type DraftMedia = {
	/** Stable across uploads and crops, for keyed lists. */
	key: string
	kind: MediaKind
	/** What the tray shows: a local object URL for new uploads, the stored URL otherwise. */
	preview: string
	/** The stored URL, once a photo or video finishes uploading. */
	url?: string
	width: number
	height: number
	/** The description (alt text) screen readers announce; blank for none. */
	alt: string
	state: 'uploading' | 'ready' | 'failed'
	/** Already on the post being edited: never deleted from here, only left out on save. */
	existing?: boolean
	/** The file as picked, so cropping always starts from the full photo. */
	original?: File
	/** The last crop, in the original's pixels. */
	crop?: CropBox
	/** Which upload is current, so a slow earlier one can't land after a re-crop. */
	upload?: string
}

export type DraftPoll = { options: string[]; days: PollDays }

/** The panel open under the text: one at a time. */
export type Panel = 'gif' | 'place' | 'emoji'

/** Why some picked files were skipped, for one toast per reason. */
export type PickResult = { skipped: UploadProblem[]; over_limit: boolean }

/** Animated GIFs would lose their animation in a canvas, so only stills can be cropped. */
export const croppable = (item: DraftMedia) =>
	item.kind === 'image' && !!item.original && item.original.type !== 'image/gif'

/** A picked file that passed the checks, with its size and kind. */
type Accepted = { file: File; kind: 'image' | 'video'; size?: VideoProbe }

/** One post being written: text plus photos, GIFs and videos, a poll, a place. */
export class Draft {
	text = $state('')
	media = $state<DraftMedia[]>([])
	poll = $state<DraftPoll>()
	location = $state<string>()
	panel = $state<Panel>()

	readonly trimmed = $derived(this.text.trim())
	readonly uploading = $derived(this.media.some((item) => item.state === 'uploading'))
	readonly failed = $derived(this.media.some((item) => item.state === 'failed'))
	readonly problem = $derived(
		draft_problem({ body: this.trimmed, media: this.media, poll: this.poll }),
	)
	readonly ready = $derived(!this.uploading && !this.failed && !this.problem)
	/** Anything worth asking about before it's thrown away. */
	readonly dirty = $derived(
		!!this.trimmed || this.media.length > 0 || !!this.poll || !!this.location,
	)
	readonly media_room = $derived(this.poll ? 0 : MEDIA_MAX - this.media.length)
	readonly can_poll = $derived(!this.poll && this.media.length === 0)

	/** Start an edit from what the post shows now. */
	static editing(content: PostContent) {
		const draft = new Draft()
		draft.text = content.body
		draft.media = content.media.map((item, i) => ({
			...item,
			alt: item.alt ?? '',
			// Posts from before duplicates were refused may hold one GIF twice.
			key: `${i}:${item.url}`,
			preview: item.url,
			state: 'ready',
			existing: true,
		}))
		return draft
	}

	/** Whether an edit would change nothing: same text, same photos in the same order. */
	matches(content: PostContent) {
		return this.trimmed === content.body && this.media_matches(content.media)
	}

	/** Whether the photos are the post's, in the same order, with the same descriptions. */
	media_matches(media: Media[]) {
		const payload = this.media_payload()
		return (
			payload.length === media.length &&
			payload.every((item, i) => item.url === media[i].url && item.alt === media[i].alt)
		)
	}

	/**
	 * Whether an edit can be saved: text is optional only while media remain, and a post from
	 * before duplicates were refused must drop its second copy of a GIF.
	 */
	readonly edit_ready = $derived(
		!post_problem(this.trimmed, this.media.length > 0) && !has_duplicates(this.media),
	)

	/** The photos, GIFs and videos as `create_post` and `edit_post` take them, once `ready`. */
	media_payload(): Media[] {
		return this.media.map(({ kind, url, width, height, alt }) => ({
			kind,
			url: url!,
			width,
			height,
			alt: alt.trim() || undefined,
		}))
	}

	/** What `create_post` takes, once `ready`. */
	payload() {
		return {
			body: this.trimmed,
			media: this.media_payload(),
			poll: this.poll && { options: [...this.poll.options], days: this.poll.days },
			location: this.location,
		}
	}

	toggle(panel: Panel) {
		this.panel = this.panel === panel ? undefined : panel
	}

	/** Add a GIF, unless there's no room or it's already on the post. */
	add_gif(gif: Gif) {
		const { url, width, height } = gif.full
		if (this.media_room <= 0 || this.media.some((item) => item.url === url)) return
		this.media.push({
			key: gif.id + crypto.randomUUID(),
			kind: 'gif',
			preview: url,
			url,
			width,
			height,
			alt: '',
			state: 'ready',
		})
		this.panel = undefined
	}

	/** Start uploading what fits; the rest is reported, not silently dropped. */
	async add_files(files: File[]): Promise<PickResult> {
		const skipped: UploadProblem[] = []
		const checked = await Promise.all(files.map(accept))
		const fitting = checked.filter((result): result is Accepted => {
			if ('problem' in result) skipped.push(result.problem)
			return !('problem' in result)
		})
		const room = Math.max(0, this.media_room)
		for (const accepted of fitting.slice(0, room)) this.#add_upload(accepted)
		return { skipped, over_limit: fitting.length > room }
	}

	#add_upload({ file, kind, size }: Accepted) {
		const key = crypto.randomUUID()
		this.media.push({
			key,
			kind,
			preview: '',
			width: size?.width ?? 1,
			height: size?.height ?? 1,
			alt: '',
			state: 'uploading',
			original: file,
		})
		void this.#upload(key, file)
	}

	/** Swap a photo for its cropped version, remembering the crop to start from next time. */
	recrop(key: string, cropped: File, crop: CropBox) {
		const item = this.#find(key)
		if (!item || item.existing) return
		this.#release(item)
		Object.assign(item, { crop, url: undefined })
		void this.#upload(key, cropped)
	}

	/** Upload `file` as the item's photo or video; a newer upload for the same item wins. */
	async #upload(key: string, file: File) {
		const upload = crypto.randomUUID()
		const item = this.#find(key)
		if (!item) return
		Object.assign(item, { preview: URL.createObjectURL(file), state: 'uploading', upload })
		try {
			// A video was measured when it was picked; a photo changes size when it's cropped.
			const [size, url] = await Promise.all([
				item.kind === 'image' ? measure(file) : undefined,
				upload_media(file),
			])
			const current = this.#find(key)
			if (current?.upload !== upload) return discard_upload(url)
			Object.assign(current, size, { url, state: 'ready' })
		} catch {
			const current = this.#find(key)
			if (current?.upload === upload) current.state = 'failed'
		}
	}

	/** Set the description of one photo or GIF. */
	describe(key: string, alt: string) {
		const item = this.#find(key)
		if (item) item.alt = alt
	}

	#find(key: string) {
		return this.media.find((item) => item.key === key)
	}

	/** Move one photo or GIF to another spot; the post keeps this order. */
	move_media(from: number, to: number) {
		if (from === to || to < 0 || to >= this.media.length) return
		const [item] = this.media.splice(from, 1)
		this.media.splice(to, 0, item)
	}

	remove_media(key: string) {
		const item = this.#find(key)
		if (!item) return
		this.media = this.media.filter((other) => other !== item)
		this.#release(item)
	}

	/** Let go of a new upload's preview and file. A published post's are left alone. */
	#release(item: DraftMedia) {
		if (!is_upload(item.kind) || item.existing) return
		URL.revokeObjectURL(item.preview)
		if (item.url) discard_upload(item.url)
	}

	add_poll() {
		if (!this.can_poll) return
		this.poll = { options: Array(POLL_MIN_OPTIONS).fill(''), days: 1 }
		this.panel = undefined
	}

	add_poll_option() {
		if (this.poll && this.poll.options.length < POLL_MAX_OPTIONS) this.poll.options.push('')
	}

	remove_poll_option(index: number) {
		if (this.poll && this.poll.options.length > POLL_MIN_OPTIONS) this.poll.options.splice(index, 1)
	}

	/** Empty the draft after publishing: its uploads now belong to the post. */
	clear() {
		for (const item of this.media) {
			if (is_upload(item.kind) && !item.existing) URL.revokeObjectURL(item.preview)
		}
		this.text = ''
		this.media = []
		this.poll = undefined
		this.location = undefined
		this.panel = undefined
	}

	/** Throw the draft away, deleting uploads no post will use. */
	discard() {
		for (const item of this.media) this.#release(item)
		this.clear()
	}
}

/** Check one picked file; a video is probed for its size and length first. */
async function accept(file: File): Promise<Accepted | { problem: UploadProblem }> {
	const problem = upload_problem(file)
	if (problem) return { problem }
	const kind = upload_kind(file)!
	if (kind === 'image') return { file, kind }
	const size = await probe_video(file).catch(() => undefined)
	const unusable = size ? video_problem(size) : 'type'
	return unusable ? { problem: unusable } : { file, kind, size }
}
