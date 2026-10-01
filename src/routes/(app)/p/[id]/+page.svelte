<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import { replies_arg } from '#lib/posts/args'
	import Composer from '#lib/posts/Composer.svelte'
	import FocusPost from '#lib/posts/FocusPost.svelte'
	import PostCard from '#lib/posts/PostCard.svelte'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_conversation, get_post, get_replies } from '#lib/posts/posts.remote'
	import { deleted_posts } from '#lib/posts/state.svelte'
	import PostNotice from '#lib/moderation/PostNotice.svelte'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import { home_href } from '../../../(public)/links'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, form, params }: PageProps = $props()

	const post = $derived(await get_post(params.id))
	const conversation = $derived(await get_conversation(params.id))
	const above = $derived(conversation.above.filter((item) => !deleted_posts.has(item.id)))
	const below = $derived(conversation.below.filter((item) => !deleted_posts.has(item.id)))
	const hide = $derived(new Set(conversation.below.slice(0, 1).map((item) => item.id)))
</script>

<svelte:head><title>{m.site_page_title({ page: m.post_page_title() })}</title></svelte:head>

<PageBar title={m.post_page_title()} back />

{#each above as item (item.id)}
	<PostCard post={item} thread_below />
{/each}

{#if deleted_posts.has(post.id)}
	<EmptyState title={m.post_not_found_title()} body={m.post_not_found_body()} />
{:else}
	{#if data.notice}<PostNotice notice={data.notice} {form} />{/if}
	<FocusPost {post} ondeleted={() => goto(home_href(), { replaceState: true })} />
	{#if !post.moderation}
		<Composer task={{ kind: 'reply', post }} me={data.me} variant="reply" />
	{/if}
	{#each below as item, i (item.id)}
		<PostCard post={item} thread_below={i < below.length - 1} show_replying={false} />
	{/each}
	{#key post.id}
		<PostList
			load={(cursor) => get_replies(replies_arg(post.id, cursor))}
			show_replying={false}
			{hide}
		/>
	{/key}
{/if}
