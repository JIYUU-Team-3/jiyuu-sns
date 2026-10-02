export async function upload_message_photo(file: File): Promise<string> {
	const body = new FormData()
	body.set('file', file)
	const response = await fetch('/media/messages', { method: 'POST', body })
	if (!response.ok) throw new Error(`upload failed: ${response.status}`)
	const { url } = (await response.json()) as { url: string }
	return url
}
