import { describe, expect, it } from 'vitest'
import { read_form } from './form'

function upload(bytes: number, headers: Record<string, string> = {}) {
	const body = new FormData()
	body.set('file', new File([new Uint8Array(bytes)], 'photo.jpg'))
	return new Request('http://localhost/media', { method: 'POST', body, headers })
}

/** The same request with its body as a stream and no length, as a chunked upload arrives. */
async function unsized(request: Request) {
	const bytes = new Uint8Array(await request.arrayBuffer())
	const CHUNK = 64 * 1024
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let at = 0; at < bytes.length; at += CHUNK)
				controller.enqueue(bytes.subarray(at, at + CHUNK))
			controller.close()
		},
	})
	return new Request(request.url, {
		method: 'POST',
		headers: { 'content-type': request.headers.get('content-type')! },
		body,
		duplex: 'half',
	} as RequestInit)
}

describe('read_form', () => {
	it('reads a form within the limit', async () => {
		const form = await read_form(upload(1000), 2000)
		expect((form.get('file') as File).size).toBe(1000)
	})

	it('reads a form posted with no body as an empty form', async () => {
		const form = await read_form(new Request('http://localhost/login', { method: 'POST' }), 4096)
		expect([...form.keys()]).toEqual([])
	})

	it('refuses a form whose stated length is over the limit', async () => {
		const request = upload(10, { 'content-length': String(10 * 1024 * 1024) })
		await expect(read_form(request, 1024)).rejects.toMatchObject({ status: 413 })
	})

	it('refuses an oversized form that does not state its length', async () => {
		const request = await unsized(upload(300 * 1024))
		expect(request.headers.has('content-length')).toBe(false)
		await expect(read_form(request, 1024)).rejects.toMatchObject({ status: 413 })
	})
})
