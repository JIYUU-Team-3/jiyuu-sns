import { error } from '@sveltejs/kit'

/** Room for the multipart boundaries and the text fields around the files. */
const FORM_OVERHEAD_BYTES = 64 * 1024

/**
 * A request's body, refused with a 413 once it passes `max` bytes. The header can be missing or
 * wrong, so the bytes are counted as they arrive too; `over()` says whether that is what stopped it.
 */
function counted_body(request: Request, max: number) {
	if (Number(request.headers.get('content-length') ?? 0) > max) error(413, 'size')
	let seen = 0
	const body = request.body?.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				seen += chunk.byteLength
				if (seen > max) controller.error(new Error('Body too large.'))
				else controller.enqueue(chunk)
			},
		}),
	)
	return { body, over: () => seen > max }
}

/**
 * A request's form, refused with a 413 once its body passes `max_bytes` (plus a little for the
 * form's own framing). `request.formData()` alone would read a body of any size into memory
 * before a single file's size could be checked.
 */
export async function read_form(request: Request, max_bytes: number): Promise<FormData> {
	const { body, over } = counted_body(request, max_bytes + FORM_OVERHEAD_BYTES)
	// A form with no fields, such as the login button without a `next`, is posted with no body.
	if (!body) return new FormData()
	try {
		return await new Response(body, {
			headers: { 'content-type': request.headers.get('content-type') ?? '' },
		}).formData()
	} catch {
		error(over() ? 413 : 400, over() ? 'size' : 'Bad form.')
	}
}

/** A request's JSON body, under the same rule as `read_form`: never more than `max_bytes`. */
export async function read_json(request: Request, max_bytes: number): Promise<unknown> {
	const { body, over } = counted_body(request, max_bytes)
	if (!body) error(400, 'Bad JSON.')
	try {
		return await new Response(body).json()
	} catch {
		error(over() ? 413 : 400, over() ? 'size' : 'Bad JSON.')
	}
}
