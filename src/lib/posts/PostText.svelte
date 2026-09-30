<script lang="ts">
	import { profile_href } from '#lib/profiles/links'
	import { tag_href } from './links'
	import { text_segments } from './text'

	let { body }: { body: string } = $props()
</script>

{#each text_segments(body) as segment, i (i)}{#if segment.href}<a
			class="lnk"
			href={segment.href}
			target="_blank"
			rel="noopener nofollow ugc">{segment.text}</a
		>{:else if segment.tag}<a class="lnk" href={tag_href(segment.tag)}>{segment.text}</a
		>{:else if segment.handle}<a class="lnk" href={profile_href(segment.handle)}>{segment.text}</a
		>{:else}{segment.text}{/if}{/each}
