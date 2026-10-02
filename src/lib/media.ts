/** What an upload is for; each kind has its own size cap and R2 folder. */
export type ImageKind = 'avatar' | 'banner'

/** Profile images plus photos attached to posts. */
export type UploadKind = ImageKind | 'post' | 'message'

export const IMAGE_MAX_BYTES: Record<UploadKind, number> = {
	avatar: 2 * 1024 * 1024,
	banner: 5 * 1024 * 1024,
	post: 5 * 1024 * 1024,
	message: 5 * 1024 * 1024,
}

/** The file picker's `accept`. SVG is left out on purpose: it can run script from our origin. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/** Videos on posts: MP4 and QuickTime, stored as uploaded since nothing transcodes them. */
export const VIDEO_ACCEPT = 'video/mp4,video/quicktime'

/** What a post attachment upload is: a photo or a video. */
export type PostUploadKind = 'image' | 'video'

export const POST_UPLOAD_MAX_BYTES: Record<PostUploadKind, number> = {
	image: IMAGE_MAX_BYTES.post,
	video: 50 * 1024 * 1024,
}

/** `blocked`: a file a moderator removed before, refused by the server. */
export type ImageProblem = 'type' | 'size' | 'blocked'

export type ImageType = { type: string; ext: string }

export type ImageUpload = ImageType & { kind: UploadKind; bytes: ArrayBuffer }

const starts_with = (head: Uint8Array, bytes: number[], offset = 0) =>
	bytes.every((byte, i) => head[offset + i] === byte)

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))

/** The image type from a file's first 12 bytes, ignoring the name and claimed type. */
export function sniff_image(head: Uint8Array): ImageType | undefined {
	if (starts_with(head, [0xff, 0xd8, 0xff])) return { type: 'image/jpeg', ext: 'jpg' }
	if (starts_with(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return { type: 'image/png', ext: 'png' }
	if (starts_with(head, ascii('GIF8'))) return { type: 'image/gif', ext: 'gif' }
	if (starts_with(head, ascii('RIFF')) && starts_with(head, ascii('WEBP'), 8))
		return { type: 'image/webp', ext: 'webp' }
	return undefined
}

/**
 * MP4 and QuickTime brands. HEIC and AVIF photos use the same box format (`ftyp` at byte 4), so
 * the brand is what tells a video apart.
 */
const VIDEO_BRANDS = new Set([
	'isom',
	'iso2',
	'iso4',
	'iso5',
	'iso6',
	'mp41',
	'mp42',
	'avc1',
	'M4V ',
	'M4VP',
	'MSNV',
	'qt  ',
])

/** Whether a file's first 12 bytes start an MP4 or QuickTime video, whatever its name says. */
export function sniff_video(head: Uint8Array): boolean {
	if (head.length < 12 || !starts_with(head, ascii('ftyp'), 4)) return false
	return VIDEO_BRANDS.has(String.fromCharCode(...head.subarray(8, 12)))
}

/** A post upload's kind from its bytes, or undefined for anything else. */
export async function sniff_post_upload(file: File): Promise<PostUploadKind | undefined> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	if (sniff_image(head)) return 'image'
	if (sniff_video(head)) return 'video'
	return undefined
}

/** A form field's file, or undefined when the picker was left empty. */
export function picked_file(value: FormDataEntryValue | null): File | undefined {
	return value instanceof File && value.size > 0 ? value : undefined
}

/** Why `file` can't be used as a `kind` image, or undefined when it's fine. */
export async function image_problem(
	file: File,
	kind: UploadKind,
): Promise<ImageProblem | undefined> {
	if (file.size > IMAGE_MAX_BYTES[kind]) return 'size'
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return sniff_image(head) ? undefined : 'type'
}

/** Read a checked upload; call `image_problem` first. */
export async function read_image(file: File, kind: UploadKind): Promise<ImageUpload> {
	const bytes = await file.arrayBuffer()
	const type = sniff_image(new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)))
	if (!type) throw new Error('read_image called on an unchecked file')
	return { kind, bytes, ...type }
}
