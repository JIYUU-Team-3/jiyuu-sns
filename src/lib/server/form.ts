import { error } from '@sveltejs/kit'

/** Room for the multipart boundaries and the text fields around the files. */
const FORM_OVERHEAD_BYTES = 64 * 1024

/**
 * A request's form, refused with a 413 once its body passes `max_bytes` (plus a little for the
 * form's own framing). `request.formData()` alone would read a body of any size into memory
 * before a single file's size could be checked.
 */
export async function read_form(request: Request, max_bytes: number): Promise<FormData> {
	const max = max_bytes + FORM_OVERHEAD_BYTES
	if (Number(request.headers.get('content-length') ?? 0) > max) error(413, 'size')
	if (!request.body) error(400, 'No form.')

	// The header can be missing or wrong, so the bytes are counted as they arrive too.
	let seen = 0
	const counted = request.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				seen += chunk.byteLength
				if (seen > max) controller.error(new Error('Form too large.'))
				else controller.enqueue(chunk)
			},
		}),
	)
	try {
		return await new Response(counted, {
			headers: { 'content-type': request.headers.get('content-type') ?? '' },
		}).formData()
	} catch {
		error(seen > max ? 413 : 400, seen > max ? 'size' : 'Bad form.')
	}
}
