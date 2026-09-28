<script lang="ts">
	import { goto } from '$app/navigation'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import { format_age, format_timestamp } from './format'
	import { post_href } from './links'
	import PostActions from './PostActions.svelte'
	import PostMenu from './PostMenu.svelte'
	import PostText from './PostText.svelte'
	import { current_time, edited_posts } from './state.svelte'
	import type { PostView } from './types'

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

	const body = $derived(edited_posts.get(post.id) ?? post.body)
	const edited = $derived(post.edited || edited_posts.has(post.id))
	const href = $derived(post_href(post.id))
	const author_href = $derived(post.author.handle ? profile_href(post.author.handle) : undefined)

	/**
	 * The whole row opens the post, as on X, except when the click lands on something that does
	 * its own thing or finishes a text selection.
	 */
	function open(event: MouseEvent) {
		const target = event.target as Element
		if (target.closest('a, button, [role="menu"], dialog')) return
		if (getSelection()?.toString()) return
		if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener')
		else goto(href)
	}
</script>

<!-- The timestamp link is the keyboard path to the post; the row click is a pointer shortcut. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="post" class:has-next={thread_below} onclick={open}>
	<div class="row">
		<div class="gutter">
			<!-- The name link below is the keyboard path; the avatar is a pointer shortcut. -->
			<svelte:element
				this={author_href ? 'a' : 'span'}
				href={author_href}
				tabindex="-1"
				aria-hidden="true"
			>
				<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} />
			</svelte:element>
			{#if thread_below}<div class="thread-line"></div>{/if}
		</div>
		<div class="body">
			<div class="head">
				<svelte:element this={author_href ? 'a' : 'span'} class="nm" href={author_href}
					>{post.author.name}</svelte:element
				>
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
			{#if show_replying && post.reply_to?.handle}
				<div class="replying">
					{#each m.composer_replying_to.parts() as part, i (i)}
						{#if part.type === 'text'}{part.value}{:else if part.name === 'handle'}<span class="lnk"
								>@{post.reply_to.handle}</span
							>{/if}
					{/each}
				</div>
			{/if}
			<div class="text"><PostText {body} /></div>
			<PostActions {post} />
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
	.gutter {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
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
	a.nm:hover {
		text-decoration: underline;
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
	.head :global(.more-wrap) {
		margin: -8px -8px -8px auto;
	}
	.replying {
		color: var(--text-2);
		margin: 1px 0 2px;
	}
	.text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin: 2px 0 0;
	}
</style>
