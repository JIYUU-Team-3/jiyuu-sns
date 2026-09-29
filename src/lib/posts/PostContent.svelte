<script lang="ts">
	import Icon from '#lib/ui/Icon.svelte'
	import { search_href } from './links'
	import Poll from './Poll.svelte'
	import PostMedia from './PostMedia.svelte'
	import PostText from './PostText.svelte'
	import { post_content } from './state.svelte'
	import type { PostView } from './types'

	/** Everything under a post's header: text, photos or GIFs, poll and place. */
	let {
		post,
		focus = false,
		onswipe,
	}: {
		post: PostView
		focus?: boolean
		/** A carousel was swiped away from, or back to, its first photo. */
		onswipe?: (swiped: boolean, top: number) => void
	} = $props()

	const content = $derived(post_content(post))
</script>

{#if content.body}<div class="text" class:focus><PostText body={content.body} /></div>{/if}
<PostMedia media={content.media} {focus} {onswipe} />
{#if post.poll}<Poll post_id={post.id} poll={post.poll} mine={post.mine} />{/if}
{#if post.location}
	<a class="place" href={search_href(post.location)}>
		<Icon name="pin" size="xs" />{post.location}
	</a>
{/if}

<style>
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin: 2px 0 0;
	}
	.text.focus {
		font-size: 17px;
		line-height: 1.45;
		margin-top: 12px;
	}
	.place {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text-2);
		font-size: 13px;
		margin-top: 10px;
	}
	.place:hover {
		color: var(--accent-text);
	}
</style>
