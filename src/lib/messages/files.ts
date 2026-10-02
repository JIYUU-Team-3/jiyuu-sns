import { IMAGE_MAX_BYTES, sniff_image } from '#lib/media'

export const MESSAGE_FILE_MAX_BYTES = IMAGE_MAX_BYTES.message

/** Preview only the raster formats the image upload path can safely clean. */
export async function message_file_kind(file: File): Promise<'image' | 'file'> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return sniff_image(head) ? 'image' : 'file'
}

/** Store the display name separately from the generated storage key. */
export function message_file_name(name: string) {
	const filename = name.split(/[/\\]/).at(-1) ?? ''
	return (
		[...filename]
			.filter((char) => !/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(char))
			.join('')
			.slice(0, 255)
			.toWellFormed() || 'file'
	)
}

export function file_size(bytes: number) {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
