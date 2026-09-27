import type { MessagePart } from '#lib/paraglide/runtime'

export type Segment = { text: string; href?: string }

/**
 * Flatten Paraglide message parts into text runs. A run inside a markup tag named in
 * `hrefs` carries that href; runs inside unknown tags stay plain text.
 */
export function link_segments(parts: MessagePart[], hrefs: Record<string, string>): Segment[] {
	const segments: Segment[] = []
	let href: string | undefined
	for (const part of parts) {
		if (part.type === 'markup-start') href = hrefs[part.name]
		else if (part.type === 'markup-end') href = undefined
		else if (part.type === 'text')
			segments.push(href ? { text: part.value, href } : { text: part.value })
	}
	return segments
}
