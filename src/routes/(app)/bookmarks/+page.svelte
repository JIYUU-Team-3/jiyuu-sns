<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { bookmarks_arg } from '#lib/posts/args'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_bookmarks } from '#lib/posts/posts.remote'
	import { bookmarked_posts } from '#lib/posts/state.svelte'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import { home_href } from '../../(public)/links'
	import PageBar from '../PageBar.svelte'

	/** Posts unsaved in this tab leave the list at once. */
	const unsaved = $derived(
		new Set([...bookmarked_posts].filter(([, saved]) => !saved).map(([id]) => id)),
	)
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_bookmarks() })}</title></svelte:head>

<PageBar title={m.app_bookmarks()} subtitle={m.bookmarks_subtitle()} back />

<PostList load={(cursor) => get_bookmarks(bookmarks_arg(cursor))} hide={unsaved}>
	{#snippet empty()}
		<EmptyState title={m.bookmarks_empty_title()} body={m.bookmarks_empty_body()}>
			<a class="btn btn-primary" href={home_href()}>{m.bookmarks_empty_action()}</a>
		</EmptyState>
	{/snippet}
</PostList>
