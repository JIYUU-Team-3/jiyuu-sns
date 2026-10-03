<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import NumberRoll from '#lib/ui/NumberRoll.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { format_count } from './format'
	import { bookmarks_href, post_url } from './links'
	import { set_bookmark, set_like, set_repost } from './posts.remote'
	import {
		bookmarked_posts,
		composer,
		is_bookmarked,
		like_state,
		liked_posts,
		repost_state,
		reposted_posts,
	} from './state.svelte'
	import type { PostView } from './types'

	let { post, focus = false }: { post: PostView; focus?: boolean } = $props()

	const liked = $derived(like_state(post).liked)
	const likes = $derived(like_state(post).likes)
	const reposted = $derived(repost_state(post).reposted)
	const reposts = $derived(repost_state(post).reposts)
	const bookmarked = $derived(is_bookmarked(post))
	/** A repost made before the account went private can still be taken back. */
	const shareable = $derived(post.can_share || reposted)
	let popping = $state(false)

	/** Optimistic: the heart flips at once and rolls back if the server says no. */
	async function toggle_like() {
		const before = like_state(post)
		const on = !before.liked
		liked_posts.set(post.id, { liked: on, likes: before.likes + (on ? 1 : -1) })
		popping = on
		try {
			await set_like({ id: post.id, on })
		} catch {
			liked_posts.set(post.id, before)
			toast.show(m.toast_error())
		}
	}

	/** Optimistic, like the heart. */
	async function toggle_repost() {
		const before = repost_state(post)
		const on = !before.reposted
		reposted_posts.set(post.id, { reposted: on, reposts: before.reposts + (on ? 1 : -1) })
		toast.show(on ? m.toast_reposted() : m.toast_unreposted())
		try {
			await set_repost({ id: post.id, on })
		} catch {
			reposted_posts.set(post.id, before)
			toast.show(m.toast_error())
		}
	}

	/** Optimistic, like the heart; a new bookmark offers the way to the list. */
	async function toggle_bookmark() {
		const before = is_bookmarked(post)
		const on = !before
		bookmarked_posts.set(post.id, on)
		if (on) toast.show(m.toast_bookmarked(), { label: m.toast_view(), href: bookmarks_href() })
		else toast.show(m.toast_unbookmarked())
		try {
			await set_bookmark({ id: post.id, on })
		} catch {
			bookmarked_posts.set(post.id, before)
			toast.show(m.toast_error())
		}
	}

	async function share() {
		try {
			await navigator.clipboard.writeText(post_url(post.id))
			toast.show(m.toast_link_copied())
		} catch {
			toast.show(m.toast_error())
		}
	}

	/** Counts sit next to the icon in feeds; the focus post shows them in its stats row instead. */
	const count_text = (n: number) => (n ? format_count(n, getLocale()) : '')
	const label = (name: string, n: number) => (focus || !n ? name : `${name}, ${n}`)
</script>

<!-- Every count rolls when it changes, from the start of its column so it never drifts. -->
{#snippet count(n: number)}
	<span class="num cnt"><NumberRoll value={n} text={count_text(n)} anchor="start" /></span>
{/snippet}

<!-- Reply, repost and like each own a third of the row's left part, whatever their counts. -->
<div class="actions" class:focus>
	<div class="col">
		<button
			type="button"
			class="act reply"
			aria-label={label(post.can_reply ? m.action_reply() : m.action_reply_limited(), post.replies)}
			title={post.can_reply ? undefined : m.action_reply_limited()}
			disabled={!post.can_reply}
			onclick={() => composer.open({ kind: 'reply', post })}
		>
			<span class="hit"><Icon name="reply" size={focus ? 'md' : 'sm'} /></span>
			{@render count(post.replies)}
		</button>
	</div>
	<Menu label={m.action_repost()} placement="cover-start" class="col">
		{#snippet trigger(props)}
			<button
				type="button"
				class="act rp"
				class:on={reposted}
				aria-label={label(reposted ? m.action_reposted() : m.action_repost(), reposts)}
				title={shareable ? undefined : m.action_repost_private()}
				{...props}
				disabled={!shareable}
			>
				<span class="hit"><Icon name="repost" size={focus ? 'md' : 'sm'} /></span>
				{@render count(reposts)}
			</button>
		{/snippet}
		{#snippet children(close)}
			<button
				type="button"
				class="menu-item"
				role="menuitem"
				onclick={() => {
					close()
					toggle_repost()
				}}
			>
				<Icon name="repost" />{reposted ? m.action_undo_repost() : m.action_repost()}
			</button>
			{#if post.can_share}
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => {
						close()
						composer.open({ kind: 'quote', post })
					}}
				>
					<Icon name="quote" />{m.action_quote()}
				</button>
			{/if}
		{/snippet}
	</Menu>
	<div class="col">
		<button
			type="button"
			class="act like"
			class:on={liked}
			class:popping
			aria-label={label(liked ? m.action_liked() : m.action_like(), likes)}
			aria-pressed={liked}
			onclick={toggle_like}
			onanimationend={() => (popping = false)}
		>
			<span class="hit"><Icon name="heart" size={focus ? 'md' : 'sm'} filled={liked} /></span>
			{@render count(likes)}
		</button>
	</div>
	<div class="right">
		<button
			type="button"
			class="act bm"
			class:on={bookmarked}
			aria-label={bookmarked ? m.action_bookmarked() : m.action_bookmark()}
			aria-pressed={bookmarked}
			onclick={toggle_bookmark}
		>
			<span class="hit"
				><Icon name="bookmark" size={focus ? 'md' : 'sm'} filled={bookmarked} /></span
			>
		</button>
		<button type="button" class="act share" aria-label={m.action_share()} onclick={share}>
			<span class="hit"><Icon name="share" size={focus ? 'md' : 'sm'} /></span>
		</button>
	</div>
</div>

<style>
	.actions {
		display: flex;
		max-width: 440px;
		margin: 6px 0 0 -8px;
	}
	/*
	 * Columns sized by the row, not by their counts: a count gaining a digit, or appearing at all,
	 * never moves the buttons beside it, and the row fits a phone as narrow as an iPhone SE.
	 */
	.actions :global(.col) {
		flex: 1 1 0;
		min-width: 0;
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		color: var(--text-2);
		font-size: 13px;
		height: 34px;
		padding-right: 8px;
		transition: color 0.15s;
	}
	.act:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.hit {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		transition: background-color 0.15s;
	}
	.cnt {
		white-space: nowrap;
	}
	.reply:hover:enabled,
	.share:hover,
	.bm:hover,
	.bm.on {
		color: var(--accent-text);
	}
	.reply:hover:enabled .hit,
	.share:hover .hit,
	.bm:hover .hit {
		background: var(--accent-soft);
	}
	.rp:hover,
	.rp.on {
		color: var(--repost);
	}
	.rp:hover .hit {
		background: var(--repost-soft);
	}
	/* Repost is the one icon that thickens rather than fills when on. */
	.rp.on :global(.ico) {
		stroke-width: 2.4;
	}
	.like:hover,
	.like.on {
		color: var(--like);
	}
	.like:hover .hit {
		background: var(--like-soft);
	}
	.like.popping :global(.ico) {
		animation: heart-pop 0.42s var(--ease-out);
	}
	@keyframes heart-pop {
		0% {
			transform: scale(1);
		}
		30% {
			transform: scale(0.7);
		}
		65% {
			transform: scale(1.22);
		}
		100% {
			transform: scale(1);
		}
	}
	.right {
		display: flex;
	}

	/* Focus post: a full-width bar with the five actions spread evenly and no counts. */
	.focus {
		justify-content: space-between;
		max-width: none;
		padding: 4px;
		margin: 0;
		border-top: 1px solid var(--line);
	}
	.focus :global(.col) {
		flex: none;
	}
	.focus .right {
		display: contents;
	}
	.focus .act {
		padding-right: 0;
	}
	.focus .hit {
		width: 38px;
		height: 38px;
	}
	.focus .cnt {
		display: none;
	}

	@media (max-width: 700px) {
		.actions {
			max-width: none;
		}
	}
	/* The narrowest phones give the columns every spare pixel, so a four-character count fits. */
	@media (max-width: 360px) {
		.actions:not(.focus) .act {
			gap: 0;
		}
		.actions:not(.focus) .right .act {
			padding-right: 0;
		}
	}
</style>
