import { IMAGE_ACCEPT, POST_UPLOAD_MAX_BYTES, VIDEO_ACCEPT, type PostUploadKind } from '#lib/media'
import { VIDEO_MAX_SECONDS } from '../rules'

export type UploadProblem = 'type' | 'size' | 'duration'

/** The file picker's `accept`: photos and videos. */
export const POST_UPLOAD_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`

/** A picked file's kind by its claimed type; the server sniffs the bytes again either way. */
export function upload_kind(file: File): PostUploadKind | undefined {
	if (IMAGE_ACCEPT.split(',').includes(file.type)) return 'image'
	if (VIDEO_ACCEPT.split(',').includes(file.type)) return 'video'
	return undefined
}

/** A quick check before uploading; a video's length is checked once it's probed. */
export function upload_problem(file: File): UploadProblem | undefined {
	const kind = upload_kind(file)
	if (!kind) return 'type'
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

/** Upload one photo or video; resolves to its `/media/posts/…` URL. */
export async function upload_media(file: File): Promise<string> {
	const body = new FormData()
	body.set('file', file)
	const response = await fetch('/media', { method: 'POST', body })
	if (!response.ok) throw new Error(`upload failed: ${response.status}`)
	const { url } = (await response.json()) as { url: string }
	return url
}

/** Whether the automatic check found an uploaded photo sensitive. Best effort: no answer is no. */
export async function is_sensitive_upload(url: string) {
	const body = new FormData()
	body.set('url', url)
	const response = await fetch('/media/check', { method: 'POST', body }).catch(() => undefined)
	if (!response?.ok) return false
	const { sensitive } = (await response.json()) as { sensitive: boolean }
	return sensitive
}

/** Drop an upload that never made it into a post. Best effort: a leftover file is harmless. */
export function discard_upload(url: string) {
	fetch(url, { method: 'DELETE' }).catch(() => {})
}
