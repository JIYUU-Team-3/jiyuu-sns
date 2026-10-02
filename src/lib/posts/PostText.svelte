<script lang="ts">
	import { profile_href } from '#lib/profiles/links'
	import { is_blocked_link } from './blocked'
	import { tag_href } from './links'
	import { text_segments } from './text'

	let {
		body,
		blocked = [],
		out,
	}: {
		body: string
		/** Blocked domains: their links are drawn as plain text. */
		blocked?: readonly string[]
		/** Where the `n`th link goes instead of straight out, e.g. the "leaving Jiyuu" page. */
		out?: (n: number) => string
	} = $props()

	/** Each segment with the index of its link among the text's links, for `out`. */
	const segments = $derived.by(() => {
		let n = 0
		return text_segments(body).map((segment) => ({
			...segment,
			n: segment.href ? n++ : -1,
			blocked: !!segment.href && is_blocked_link(segment.href, blocked),
		}))
	})
</script>

{#each segments as segment, i (i)}{#if segment.href && !segment.blocked}<a
			class="lnk"
			href={out ? out(segment.n) : segment.href}
			target={out ? undefined : '_blank'}
			rel="noopener noreferrer nofollow ugc">{segment.text}</a
		>{:else if segment.tag}<a class="lnk" href={tag_href(segment.tag)}>{segment.text}</a
		>{:else if segment.handle}<a class="lnk" href={profile_href(segment.handle)}>{segment.text}</a
		>{:else}{segment.text}{/if}{/each}
