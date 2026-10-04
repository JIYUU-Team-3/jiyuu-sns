<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import NumberRoll from '#lib/ui/NumberRoll.svelte'
	import { format_count, format_timestamp } from './format'
	import PostActions from './PostActions.svelte'
	import PostMenu from './PostMenu.svelte'
	import PostContent from './PostContent.svelte'
	import { edited_posts, like_state, repost_state } from './state.svelte'
	import NameBadges from '#lib/profiles/NameBadges.svelte'
	import type { PostView } from './types'

	let {
		post,
		media = true,
		ondeleted,
	}: {
		post: PostView
		/** Off beside the full-screen viewer, which is already showing them. */
		media?: boolean
		ondeleted?: () => void
	} = $props()

	const edited = $derived(post.edited || edited_posts.has(post.id))
	const locale = $derived(getLocale())
	const likes = $derived(like_state(post).likes)
	const reposts = $derived(repost_state(post).reposts)

	/** The stats row, in order; a zero count is left out. */
	const stats = $derived(
		[
			{ n: post.replies, one: m.stat_reply, many: m.stat_replies },
			{ n: reposts, one: m.stat_repost, many: m.stat_reposts },
			{ n: post.quotes, one: m.stat_quote, many: m.stat_quotes },
			{ n: likes, one: m.stat_like, many: m.stat_likes },
		].filter((stat) => stat.n > 0),
	)
</script>

<article class="focus">
	<div class="fhead">
		{#if post.author.handle}
			<a href={profile_href(post.author.handle)} class="av-link" tabindex="-1" aria-hidden="true">
				<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} size={48} />
			</a>
			<a class="who" href={profile_href(post.author.handle)}>
				<div class="nm">
					{post.author.name}
					<NameBadges of={post.author} />
				</div>
				<div class="hd">@{post.author.handle}</div>
			</a>
		{:else}
			<Avatar name={post.author.name} seed={post.author.id} image={post.author.image} size={48} />
			<div class="who">
				<div class="nm">
					{post.author.name}
					<NameBadges of={post.author} />
				</div>
			</div>
		{/if}
		<PostMenu {post} {ondeleted} />
	</div>
	{#if post.reply_to?.handle && !post.reply_to.self}
		<div class="replying">
			{#each m.composer_replying_to.parts() as part, i (i)}
				{#if part.type === 'text'}{part.value}{:else if part.name === 'handle'}<span class="lnk"
						>@{post.reply_to.handle}</span
					>{/if}
			{/each}
		</div>
	{/if}
	<PostContent {post} {media} focus />
	<div class="fmeta">
		<time datetime={new Date(post.created_at).toISOString()}
			>{format_timestamp(post.created_at, locale)}</time
		>
		{#if edited}<span>· {m.post_edited()}</span>{/if}
	</div>
	{#if stats.length}
		<div class="fstats num">
			{#each stats as stat (stat.one)}
				<span
					><b><NumberRoll value={stat.n} text={format_count(stat.n, locale)} /></b>
					{stat.n === 1 ? stat.one() : stat.many()}</span
				>
			{/each}
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
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hd {
		color: var(--text-2);
	}
	.replying {
		color: var(--text-2);
		margin-top: 12px;
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
		flex-wrap: wrap;
		gap: 4px 20px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		font-size: 14px;
		color: var(--text-2);
	}
	.fstats b {
		color: var(--text);
		font-weight: 700;
	}
	.av-link {
		display: flex;
	}
	a.who:hover .nm {
		text-decoration: underline;
	}
</style>
