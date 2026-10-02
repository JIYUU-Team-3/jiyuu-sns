<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { format_count } from './format'
	import { post_url } from './links'
	import { set_like } from './posts.remote'
	import { composer, like_state, liked_posts } from './state.svelte'
	import type { PostView } from './types'

	let { post, focus = false }: { post: PostView; focus?: boolean } = $props()

	const liked = $derived(like_state(post).liked)
	const likes = $derived(like_state(post).likes)
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

	async function share() {
		try {
			await navigator.clipboard.writeText(post_url(post.id))
			toast.show(m.toast_link_copied())
		} catch {
			toast.show(m.toast_error())
		}
	}

	/** Counts sit next to the icon in feeds; the focus post shows them in its stats row instead. */
	const count = (n: number) => (focus || !n ? '' : format_count(n, getLocale()))
	const label = (name: string, n: number) => (focus || !n ? name : `${name}, ${n}`)
</script>

<div class="actions" class:focus>
	<button
		type="button"
		class="act reply"
		aria-label={label(post.can_reply ? m.action_reply() : m.action_reply_limited(), post.replies)}
		title={post.can_reply ? undefined : m.action_reply_limited()}
		disabled={!post.can_reply}
		onclick={() => composer.open({ kind: 'reply', post })}
	>
		<span class="hit"><Icon name="reply" size={focus ? 'md' : 'sm'} /></span>
		<span class="num cnt">{count(post.replies)}</span>
	</button>
	<button
		type="button"
		class="act rp"
		aria-label={m.action_repost()}
		onclick={() => toast.show(m.toast_coming_soon())}
	>
		<span class="hit"><Icon name="repost" size={focus ? 'md' : 'sm'} /></span>
		<span class="num cnt"></span>
	</button>
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
		<span class="num cnt">{count(likes)}</span>
	</button>
	<div class="right">
		<button
			type="button"
			class="act bm"
			aria-label={m.action_bookmark()}
			onclick={() => toast.show(m.toast_coming_soon())}
		>
			<span class="hit"><Icon name="bookmark" size={focus ? 'md' : 'sm'} /></span>
		</button>
		<button type="button" class="act share" aria-label={m.action_share()} onclick={share}>
			<span class="hit"><Icon name="share" size={focus ? 'md' : 'sm'} /></span>
		</button>
	</div>
</div>

<style>
	.actions {
		display: flex;
		justify-content: space-between;
		max-width: 440px;
		margin: 6px 0 0 -8px;
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
		min-width: 1ch;
	}
	.reply:hover:enabled,
	.share:hover,
	.bm:hover {
		color: var(--accent-text);
	}
	.reply:hover:enabled .hit,
	.share:hover .hit,
	.bm:hover .hit {
		background: var(--accent-soft);
	}
	.rp:hover {
		color: var(--repost);
	}
	.rp:hover .hit {
		background: var(--repost-soft);
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
		max-width: none;
		padding: 4px;
		margin: 0;
		border-top: 1px solid var(--line);
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
</style>
