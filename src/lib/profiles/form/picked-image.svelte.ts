import {
	IMAGE_MAX_BYTES,
	image_problem,
	picked_file,
	sniff_image,
	type ImageKind,
	type ImageProblem,
} from '#lib/media'
import { m } from '#lib/paraglide/messages.js'

/** What went wrong with a picked image, in the reader's language. */
export function image_problem_text(problem: ImageProblem, kind: ImageKind) {
	if (problem === 'type') return m.onboarding_image_type()
	return m.onboarding_image_size({ mb: IMAGE_MAX_BYTES[kind] / 1024 / 1024 })
}

/** Whether a file is a GIF, which skips cropping: a canvas would keep only its first frame. */
async function is_gif(file: File) {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
	return sniff_image(head)?.type === 'image/gif'
}

/** Put `file` in `input` as its only file, or empty the input when there is none. */
function set_input_file(input: HTMLInputElement, file: File | undefined) {
	if (!file) {
		input.value = ''
		return
	}
	const files = new DataTransfer()
	files.items.add(file)
	input.files = files.files
}

/**
 * A file input's picked image: first the original waiting to be cropped, then a local preview
 * URL of the cropped file, or the reason it was refused. The input only ever sends the last
 * accepted file; a refused or abandoned pick puts that one back so the form never sends it.
 */
export class PickedImage {
	url = $state<string>()
	problem = $state<ImageProblem>()
	/** An object URL of the picked original while the cropper is open. */
	cropping = $state<string>()
	#input?: HTMLInputElement
	/** The cropped (or GIF) file the input holds, kept to restore after a refused pick. */
	#accepted?: File

	constructor(private kind: ImageKind) {}

	async pick(input: HTMLInputElement) {
		this.#stop_cropping()
		this.problem = undefined
		this.#input = input
		const file = picked_file(input.files?.[0] ?? null)
		// Some browsers empty the input when the file dialog is dismissed.
		if (!file) return this.#restore()
		const problem = await image_problem(file, this.kind)
		const gif = await is_gif(file)
		// A crop comes out far smaller than a phone photo, so an uncropped GIF is the only
		// pick that has to be under the size cap already.
		if (problem === 'type' || (problem && gif)) return this.#refuse(problem)
		if (gif) this.#accept(file)
		else this.cropping = URL.createObjectURL(file)
	}

	/** Swap the cropped image into the input in place of the original. */
	async apply(blob: Blob) {
		this.#stop_cropping()
		const ext = blob.type.split('/')[1] ?? 'png'
		const file = new File([blob], `${this.kind}.${ext}`, { type: blob.type })
		const problem = await image_problem(file, this.kind)
		if (problem) return this.#refuse(problem)
		this.#accept(file)
	}

	/** Close the cropper without a picture, keeping the previously accepted one. */
	cancel() {
		this.#stop_cropping()
		this.#restore()
	}

	/** Drop the preview and the accepted file; pass the input to also unpick the file. */
	clear(input?: HTMLInputElement) {
		this.#stop_cropping()
		if (this.url) URL.revokeObjectURL(this.url)
		this.url = undefined
		this.problem = undefined
		this.#accepted = undefined
		if (input) input.value = ''
	}

	#accept(file: File) {
		if (this.url) URL.revokeObjectURL(this.url)
		this.#accepted = file
		this.url = URL.createObjectURL(file)
		this.#restore()
	}

	#restore() {
		if (this.#input) set_input_file(this.#input, this.#accepted)
	}

	#refuse(problem: ImageProblem) {
		this.problem = problem
		this.#restore()
	}

	#stop_cropping() {
		if (this.cropping) URL.revokeObjectURL(this.cropping)
		this.cropping = undefined
	}
}
