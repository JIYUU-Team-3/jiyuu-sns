<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { tag_href } from './links'
	import type { TagView } from './types'

	let { tag, context }: { tag: TagView; context?: string } = $props()
</script>

<a class="trend" href={tag_href(tag.tag)}>
	{#if context}<span class="ctx">{context}</span>{/if}
	<span class="tag">#{tag.tag}</span>
	<span class="count"
		>{tag.posts === 1
			? m.profile_post({ count: tag.posts })
			: m.profile_posts({ count: tag.posts })}</span
	>
</a>

<style>
	.trend {
		display: block;
		padding: 10px 16px;
		border-bottom: 1px solid var(--line);
		transition: background-color 0.15s;
	}
	.trend:hover {
		background: var(--bg-2);
	}
	.ctx,
	.count {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}
	.tag {
		display: block;
		font-weight: 700;
		margin: 1px 0;
		overflow-wrap: anywhere;
	}
</style>
