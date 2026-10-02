/** Keep display names separate from storage keys and HTTP header syntax. */
export function attachment_name(name: string) {
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
