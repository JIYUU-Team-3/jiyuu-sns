/** What an upload is for; each kind has its own size cap and R2 folder. */
export type ImageKind = 'avatar' | 'banner'

export const IMAGE_MAX_BYTES: Record<ImageKind, number> = {
	avatar: 2 * 1024 * 1024,
	banner: 5 * 1024 * 1024,
}

/** The file picker's `accept`. SVG is left out on purpose: it can run script from our origin. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

export type ImageProblem = 'type' | 'size'

export type ImageType = { type: string; ext: string }

export type ImageUpload = ImageType & { kind: ImageKind; bytes: ArrayBuffer }

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

/** A form field's file, or undefined when the picker was left empty. */
export function picked_file(value: FormDataEntryValue | null): File | undefined {
	return value instanceof File && value.size > 0 ? value : undefined
}

/** Why `file` can't be used as a `kind` image, or undefined when it's fine. */
export async function image_problem(
	file: File,
	kind: ImageKind,
): Promise<ImageProblem | undefined> {
	if (file.size > IMAGE_MAX_BYTES[kind]) return 'size'
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return sniff_image(head) ? undefined : 'type'
}

/** Read a checked upload; call `image_problem` first. */
export async function read_image(file: File, kind: ImageKind): Promise<ImageUpload> {
	const bytes = await file.arrayBuffer()
	const type = sniff_image(new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)))
	if (!type) throw new Error('read_image called on an unchecked file')
	return { kind, bytes, ...type }
}
