import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from '#lib/media'

export type UploadProblem = 'type' | 'size'

/** A quick check before uploading; the server sniffs the bytes again either way. */
export function upload_problem(file: File): UploadProblem | undefined {
	if (!IMAGE_ACCEPT.split(',').includes(file.type)) return 'type'
	if (file.size > IMAGE_MAX_BYTES.post) return 'size'
	return undefined
}

/** A photo's pixel size, so posts can lay it out before it loads. */
export async function measure(file: File) {
	const bitmap = await createImageBitmap(file)
	const size = { width: bitmap.width, height: bitmap.height }
	bitmap.close()
	return size
}

/** Upload one photo; resolves to its `/media/posts/…` URL. */
export async function upload_photo(file: File): Promise<string> {
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
