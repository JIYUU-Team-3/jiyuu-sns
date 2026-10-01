<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { prefs } from '#lib/settings/prefs.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { out_href, search_href } from './links'
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
	/** Sensitive media waits behind a cover until the viewer asks for it, unless they always do. */
	let revealed = $state(false)
	const covered = $derived(
		post.sensitive && content.media.length > 0 && !revealed && !prefs.value.show_sensitive,
	)
</script>

{#if post.moderation}
	<p class="hidden-note">
		<Icon name="shield" size="xs" />
		{post.moderation === 'removed' ? m.post_hidden_removed() : m.post_hidden_limited()}
	</p>
{/if}

{#if content.body}
	<div class="text" class:focus>
		<PostText
			body={content.body}
			blocked={post.blocked_hosts}
			out={post.warn_links && !post.mine ? (n) => out_href(post.id, n) : undefined}
		/>
	</div>
{/if}
{#if covered}
	<!-- Nothing loads until the viewer chooses to see it. -->
	<div class="cover">
		<p><b>{m.post_sensitive_title()}</b> {m.post_sensitive_body()}</p>
		<button type="button" class="btn btn-outline sm" onclick={() => (revealed = true)}
			>{m.post_sensitive_show()}</button
		>
	</div>
{:else}
	<PostMedia media={content.media} {focus} {onswipe} />
{/if}
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
	.hidden-note {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0;
		font-size: 13px;
		color: var(--text-2);
	}
	.cover {
		display: grid;
		gap: 10px;
		justify-items: start;
		margin-top: 12px;
		padding: 16px;
		border-radius: var(--r-card);
		border: 1px solid var(--line);
		background: var(--bg-3);
	}
	.cover p {
		margin: 0;
		color: var(--text-2);
	}
	.cover b {
		color: var(--text);
	}
</style>
