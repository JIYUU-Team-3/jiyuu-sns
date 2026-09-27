<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import { replies_arg } from '#lib/posts/args'
	import Composer from '#lib/posts/Composer.svelte'
	import FocusPost from '#lib/posts/FocusPost.svelte'
	import PostCard from '#lib/posts/PostCard.svelte'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_post, get_replies } from '#lib/posts/posts.remote'
	import { deleted_posts } from '#lib/posts/state.svelte'
	import { home_href } from '../../../(public)/links'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, params }: PageProps = $props()

	const post = $derived(await get_post(params.id))
	const parent = $derived(
		post.reply_to && !deleted_posts.has(post.reply_to.id)
			? await get_post(post.reply_to.id).catch(() => undefined)
			: undefined,
	)
</script>

<svelte:head><title>{m.site_page_title({ page: m.post_page_title() })}</title></svelte:head>

<PageBar title={m.post_page_title()} back />

{#if parent}
	<PostCard post={parent} thread_below />
{/if}

{#if deleted_posts.has(post.id)}
	<div class="empty">
		<h2>{m.post_not_found_title()}</h2>
		<p>{m.post_not_found_body()}</p>
	</div>
{:else}
	<FocusPost {post} ondeleted={() => goto(home_href(), { replaceState: true })} />
	<Composer task={{ kind: 'reply', post }} me={data.me} variant="reply" />
	{#key post.id}
		<PostList load={(cursor) => get_replies(replies_arg(post.id, cursor))} show_replying={false} />
	{/key}
{/if}

<style>
	.empty {
		padding: 48px 32px;
		max-width: 420px;
		margin: 0 auto;
	}
	.empty h2 {
		font-size: 28px;
		line-height: 1.15;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	.empty p {
		color: var(--text-2);
		margin: 0;
	}
</style>
