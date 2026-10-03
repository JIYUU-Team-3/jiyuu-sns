<script lang="ts">
	import { goto } from '$app/navigation'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { format_age, format_timestamp } from './format'
	import { post_href } from './links'
	import PostActions from './PostActions.svelte'
	import PostMenu from './PostMenu.svelte'
	import PostContent from './PostContent.svelte'
	import { current_time, edited_posts, post_content } from './state.svelte'
	import ModeratorBadge from '#lib/moderation/ModeratorBadge.svelte'
	import type { PostView } from './types'

	/** The feed avatar's size, in pixels. */
	const AVATAR = 40

	let {
		post,
		thread_below = false,
		show_replying = true,
		ondeleted,
	}: {
		post: PostView
		/** Draw the connector down to the next post, as above a focused reply. */
		thread_below?: boolean
		show_replying?: boolean
		ondeleted?: () => void
	} = $props()

	const edited = $derived(post.edited || edited_posts.has(post.id))
	/** Who reposted it, when this entry is a repost. */
	const reposter = $derived(post.repost?.by)
	const href = $derived(post_href(post.id))
	/** The handle this post replies to, when the card should say so. */
	const replying = $derived(show_replying && !post.reply_to?.self && post.reply_to?.handle)
	/**
	 * Nothing but the header above a carousel, whose bleed reaches under the avatar. On iOS it's
	 * pushed clear instead of tucking the avatar, since restyling mid-swipe makes Safari re-snap
	 * the track back to the first slide.
	 */
	const bare = $derived.by(() => {
		const content = post_content(post)
		return !content.body && !replying && content.media.length > 1
	})

	/** Every iOS browser runs WebKit, the only engine that knows this property; iPadOS too. */
	function on_ios() {
		return CSS.supports('-webkit-touch-callout', 'none')
	}

	let gutter: HTMLDivElement
	/** The avatar's scale while a carousel beside it is swiped; undefined at full size. */
	let tuck = $state<number>()

	/**
	 * With little or no text, a carousel starts beside the avatar. Once it's swiped, shrink the
	 * avatar into the room above the photos so they pass under it, as in the mockup.
	 */
	function onswipe(swiped: boolean, top: number) {
		if (bare && on_ios()) return
		if (!swiped) tuck = undefined
		else if (tuck === undefined) {
			const room = top - gutter.getBoundingClientRect().top - 6
			if (room < AVATAR) tuck = Math.max(room, AVATAR / 2) / AVATAR
		}
	}

	/**
	 * The whole row opens the post, as on X, except when the click lands on something that does
	 * its own thing or finishes a text selection.
	 */
	function open(event: MouseEvent) {
		const target = event.target as Element
		if (target.closest('a, button, video, [role="menu"], dialog')) return
		if (getSelection()?.toString()) return
		if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener')
		else goto(href)
	}
</script>

{#snippet reposted_by()}
	{#if post.repost?.mine}
		{m.post_you_reposted()}
	{:else}
		{#each m.post_reposted_by.parts() as part, i (i)}
			{#if part.type === 'text'}{part.value}{:else if part.name === 'name'}{reposter?.name}{/if}
		{/each}
	{/if}
{/snippet}

<!-- The timestamp link is the keyboard path to the post; the row click is a pointer shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="post" class:has-next={thread_below} class:bare onclick={open}>
	{#if post.pin_top}
		<div class="ctx">
			<span class="ctx-ico"><Icon name="pushpin" size="xs" /></span>
			<span>{m.post_pinned()}</span>
		</div>
	{:else if reposter}
		<div class="ctx">
			<span class="ctx-ico"><Icon name="repost" size="xs" /></span>
			{#if reposter.handle}
				<a href={profile_href(reposter.handle)}>{@render reposted_by()}</a>
			{:else}
				<span>{@render reposted_by()}</span>
			{/if}
		</div>
	{/if}
	<div class="row">
		<div class="gutter" bind:this={gutter}>
			<div class="av" style:scale={tuck}>
				{#if post.author.handle}
					<a
						href={profile_href(post.author.handle)}
						class="av-link"
						tabindex="-1"
						aria-hidden="true"
					>
						<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} />
					</a>
				{:else}
					<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} />
				{/if}
			</div>
			{#if thread_below}<div class="thread-line"></div>{/if}
		</div>
		<div class="body">
			<div class="head">
				{#if post.author.handle}
					<a class="nm" href={profile_href(post.author.handle)}>{post.author.name}</a>
				{:else}
					<span class="nm">{post.author.name}</span>
				{/if}
				{#if post.author.moderator}<ModeratorBadge />{/if}
				{#if post.author.handle}<span class="meta">@{post.author.handle}</span>{/if}
				<span class="time" aria-hidden="true">·</span>
				<a class="time" {href} title={format_timestamp(post.created_at, getLocale())}>
					<time datetime={new Date(post.created_at).toISOString()}
						>{format_age(post.created_at, current_time(), getLocale())}</time
					>
				</a>
				{#if edited}<span class="edited">· {m.post_edited()}</span>{/if}
				<PostMenu {post} class="more-wrap" {ondeleted} />
			</div>
			{#if replying}
				<div class="replying">
					{#each m.composer_replying_to.parts() as part, i (i)}
						{#if part.type === 'text'}{part.value}{:else if part.name === 'handle'}<span class="lnk"
								>@{replying}</span
							>{/if}
					{/each}
				</div>
			{/if}
			<PostContent {post} {onswipe} />
			<PostActions {post} />
			{#if post.continued && !thread_below}
				<a class="show-thread" {href}>{m.post_show_thread()}</a>
			{/if}
		</div>
	</div>
</article>

<style>
	.post {
		border-bottom: 1px solid var(--line);
		padding: 12px 16px 4px;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.post:hover {
		background: color-mix(in srgb, var(--bg-2) 70%, transparent);
	}
	.post.has-next {
		border-bottom: 0;
	}
	.row {
		display: flex;
		gap: 12px;
	}
	/* "… reposted", its icon right-aligned to the avatar gutter. */
	.ctx {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-2);
		margin: -2px 0 4px;
		min-width: 0;
	}
	.ctx-ico {
		width: 40px;
		display: flex;
		justify-content: flex-end;
		flex: none;
	}
	.ctx a,
	.ctx span:last-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ctx a:hover {
		text-decoration: underline;
	}
	.gutter {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
	}
	.av {
		display: flex;
		transform-origin: 50% 0;
		transition: scale 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.av {
			transition: none;
		}
	}
	.thread-line {
		width: 2px;
		flex: 1;
		background: var(--line-2);
		margin-top: 4px;
		min-height: 12px;
		border-radius: 1px;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: 20px;
		min-width: 0;
	}
	.nm {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
	}
	.meta {
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
		min-width: 0;
	}
	.time {
		color: var(--text-2);
		white-space: nowrap;
		flex: none;
	}
	a.time:hover {
		text-decoration: underline;
	}
	.edited {
		color: var(--text-3);
		font-size: 13px;
		flex: none;
	}
	/*
	 * iOS only, matching `on_ios`: avatar (40) − head (20) − carousel margin (12) + a 12px gap,
	 * so the photos start below it.
	 */
	@supports (-webkit-touch-callout: none) {
		.bare .head {
			margin-bottom: 20px;
		}
	}
	.head :global(.more-wrap) {
		margin: -8px -8px -8px auto;
	}
	.replying {
		color: var(--text-2);
		margin: 1px 0 2px;
	}
	.av-link {
		display: flex;
	}
	a.nm:hover {
		text-decoration: underline;
	}
	.show-thread {
		display: inline-block;
		color: var(--accent-text);
		padding: 2px 0 10px;
	}
	.show-thread:hover {
		text-decoration: underline;
	}
</style>
