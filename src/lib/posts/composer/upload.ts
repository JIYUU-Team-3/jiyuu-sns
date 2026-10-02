import { POST_UPLOAD_MAX_BYTES, sniff_post_upload, type PostUploadKind } from '#lib/media'
import { VIDEO_MAX_SECONDS } from '../rules'

export type UploadProblem = 'type' | 'size' | 'duration'

/** Every file is accepted; supported images and videos get inline previews. */
export const POST_UPLOAD_ACCEPT = '*/*'

/** A picked file's kind from its bytes, using the same detector as the server. */
export function upload_kind(file: File): Promise<PostUploadKind> {
	return sniff_post_upload(file)
}

/** A quick check before uploading; a video's length is checked once it's probed. */
export async function upload_problem(file: File): Promise<UploadProblem | undefined> {
	const kind = await upload_kind(file)
	if (file.size > POST_UPLOAD_MAX_BYTES[kind]) return 'size'
	return undefined
}

/** A photo's pixel size, so posts can lay it out before it loads. */
export async function measure(file: File) {
	const bitmap = await createImageBitmap(file)
	const size = { width: bitmap.width, height: bitmap.height }
	bitmap.close()
	return size
}

export type VideoProbe = { width: number; height: number; seconds: number }

/** A video's shown size and length, read from its header without decoding it. */
export function probe_video(file: File): Promise<VideoProbe> {
	const video = document.createElement('video')
	const src = URL.createObjectURL(file)
	video.preload = 'metadata'
	video.muted = true
	return new Promise<VideoProbe>((resolve, reject) => {
		video.onloadedmetadata = () =>
			resolve({ width: video.videoWidth, height: video.videoHeight, seconds: video.duration })
		video.onerror = () => reject(new Error('unreadable video'))
		video.src = src
	}).finally(() => URL.revokeObjectURL(src))
}

/** Why a probed video can't be posted: unplayable here, or over the length limit. */
export function video_problem(probe: VideoProbe): UploadProblem | undefined {
	if (!probe.width || !probe.height) return 'type'
	return probe.seconds > VIDEO_MAX_SECONDS ? 'duration' : undefined
}

/** Upload one attachment; resolves to its `/media/posts/…` URL. */
export async function upload_media(file: File): Promise<string> {
	const body = new FormData()
	body.set('file', file)
	const response = await fetch('/media', { method: 'POST', body })
	if (!response.ok) throw new Error(`upload failed: ${response.status}`)
	const { url } = (await response.json()) as { url: string }
	return url
}

/** Drop an upload that never made it into a post. Best effort: a leftover file is harmless. */
export function discard_upload(url: string) {
	fetch(url, { method: 'DELETE' }).catch(() => {})
}
