<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { settings_href } from '#lib/settings/links'
	import { prefs } from '#lib/settings/prefs.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { out_href, search_href } from './links'
	import Poll from './Poll.svelte'
	import PostMedia from './PostMedia.svelte'
	import PostText from './PostText.svelte'
	import QuoteCard from './QuoteCard.svelte'
	import { post_content } from './state.svelte'
	import type { PostView } from './types'

	/** Everything under a post's header: text, photos or GIFs, poll, quoted post and place. */
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
	/**
	 * Sensitive media stays behind a cover until the viewer turns "Hide sensitive media" off in
	 * Settings. After that it either shows at once or waits for a click on each post, as they chose
	 * there. Its own author always sees it.
	 */
	let revealed = $state(false)
	const sensitive = $derived(post.sensitive && content.media.length > 0 && !post.mine)
	const hidden = $derived(sensitive && !prefs.value.show_sensitive)
	const covered = $derived(hidden || (sensitive && prefs.value.cover_sensitive && !revealed))
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
	<!-- The media is there, blurred past recognising and out of reach, with the notice over it. -->
	<div class="veil">
		<div class="blurred" inert aria-hidden="true">
			<PostMedia media={content.media} {focus} />
		</div>
		<div class="cover">
			{#if hidden}
				<p><b>{m.post_sensitive_title()}</b> {m.post_sensitive_body()}</p>
				<a class="btn btn-outline sm" href={settings_href()}>{m.post_sensitive_settings()}</a>
			{:else}
				<p><b>{m.post_sensitive_title()}</b> {m.post_sensitive_marked()}</p>
				<button type="button" class="btn btn-outline sm" onclick={() => (revealed = true)}
					>{m.post_sensitive_show()}</button
				>
			{/if}
		</div>
	</div>
{:else}
	<PostMedia media={content.media} {focus} {onswipe} />
{/if}
{#if post.poll}<Poll post_id={post.id} poll={post.poll} mine={post.mine} />{/if}
{#if post.quote}<QuoteCard quote={post.quote} />{/if}
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
	.veil {
		position: relative;
		margin-top: 12px;
		border-radius: var(--r-card);
		overflow: hidden;
		/* A short photo still leaves room for the notice. */
		min-height: 150px;
		background: var(--img-fallback);
	}
	.blurred {
		/* Scaled a little so the blur's soft edge falls outside the frame. */
		filter: blur(32px) saturate(0.8);
		transform: scale(1.15);
		pointer-events: none;
		user-select: none;
	}
	/* The media brings its own top margin; inside the veil it would show as a gap. */
	.blurred > :global(*) {
		margin-top: 0;
	}
	.cover {
		position: absolute;
		inset: 0;
		display: grid;
		gap: 10px;
		align-content: center;
		justify-items: center;
		padding: 16px;
		text-align: center;
		/* Dark whatever the theme, so the words read over any picture. */
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
	}
	.cover p {
		margin: 0;
		max-width: 40ch;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
	}
	.cover .btn {
		background: rgba(0, 0, 0, 0.55);
		border-color: rgba(255, 255, 255, 0.7);
		color: #fff;
	}
</style>
