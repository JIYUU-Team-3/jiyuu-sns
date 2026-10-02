import { IMAGE_MAX_BYTES, sniff_image } from '#lib/media'

export const MESSAGE_FILE_MAX_BYTES = IMAGE_MAX_BYTES.message

/** Preview only the raster formats the image upload path can safely clean. */
export async function message_file_kind(file: File): Promise<'image' | 'file'> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return sniff_image(head) ? 'image' : 'file'
}

export { attachment_name as message_file_name, file_size } from '#lib/files'
