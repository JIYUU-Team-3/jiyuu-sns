import { crop_output, type CropBox } from './crop-box'

function to_blob(canvas: HTMLCanvasElement, type: string) {
	return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92))
}

/**
 * Draw the cropped part of a loaded photo into a new file. WebP where the browser can encode
 * it; otherwise PNG for PNGs (to keep transparency) and JPEG for the rest.
 */
export async function render_photo(image: HTMLImageElement, box: CropBox, original: File) {
	const out = crop_output(box)
	const canvas = document.createElement('canvas')
	canvas.width = out.w
	canvas.height = out.h
	const context = canvas.getContext('2d')
	if (!context) return undefined
	context.imageSmoothingQuality = 'high'
	context.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, out.w, out.h)

	let blob = await to_blob(canvas, 'image/webp')
	if (blob?.type !== 'image/webp') {
		blob = await to_blob(canvas, original.type === 'image/png' ? 'image/png' : 'image/jpeg')
	}
	if (!blob) return undefined
	const ext = blob.type.split('/')[1]
	return new File([blob], `crop.${ext}`, { type: blob.type })
}
