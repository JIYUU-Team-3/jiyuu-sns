<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import { format_count, format_timestamp } from './format'
	import PostActions from './PostActions.svelte'
	import PostMenu from './PostMenu.svelte'
	import PostText from './PostText.svelte'
	import { edited_posts, like_state } from './state.svelte'
	import type { PostView } from './types'

	let { post, ondeleted }: { post: PostView; ondeleted?: () => void } = $props()

	const body = $derived(edited_posts.get(post.id) ?? post.body)
	const edited = $derived(post.edited || edited_posts.has(post.id))
	const locale = $derived(getLocale())
	const likes = $derived(like_state(post).likes)
	const author_href = $derived(post.author.handle ? profile_href(post.author.handle) : undefined)
</script>

<article class="focus">
	<div class="fhead">
		<svelte:element
			this={author_href ? 'a' : 'span'}
			href={author_href}
			tabindex="-1"
			aria-hidden="true"
		>
			<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} size={48} />
		</svelte:element>
		<div class="who">
			<svelte:element this={author_href ? 'a' : 'div'} class="nm" href={author_href}
				>{post.author.name}</svelte:element
			>
			{#if post.author.handle}<div class="hd">@{post.author.handle}</div>{/if}
		</div>
		<PostMenu {post} {ondeleted} />
	</div>
	{#if post.reply_to?.handle}
		<div class="replying">
			{#each m.composer_replying_to.parts() as part, i (i)}
				{#if part.type === 'text'}{part.value}{:else if part.name === 'handle'}<span class="lnk"
						>@{post.reply_to.handle}</span
					>{/if}
			{/each}
		</div>
	{/if}
	<div class="text"><PostText {body} /></div>
	<div class="fmeta">
		<time datetime={new Date(post.created_at).toISOString()}
			>{format_timestamp(post.created_at, locale)}</time
		>
		{#if edited}<span>· {m.post_edited()}</span>{/if}
	</div>
	{#if post.replies || likes}
		<div class="fstats num">
			{#if post.replies}
				<span
					><b>{format_count(post.replies, locale)}</b>
					{post.replies === 1 ? m.stat_reply() : m.stat_replies()}</span
				>
			{/if}
			{#if likes}
				<span
					><b>{format_count(likes, locale)}</b>
					{likes === 1 ? m.stat_like() : m.stat_likes()}</span
				>
			{/if}
		</div>
	{/if}
	<PostActions {post} focus />
</article>

<style>
	.focus {
		padding: 12px 16px 0;
		border-bottom: 1px solid var(--line);
	}
	.fhead {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.who {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.nm {
		display: block;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.nm:hover {
		text-decoration: underline;
	}
	.hd {
		color: var(--text-2);
	}
	.replying {
		color: var(--text-2);
		margin-top: 12px;
	}
	.text {
		font-size: 17px;
		line-height: 1.45;
		margin-top: 12px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.fmeta {
		color: var(--text-2);
		padding: 14px 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.fstats {
		display: flex;
		gap: 20px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		font-size: 14px;
		color: var(--text-2);
	}
	.fstats b {
		color: var(--text);
		font-weight: 700;
	}
</style>
