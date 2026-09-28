<script lang="ts">
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import PageBar from './PageBar.svelte'

	const missing = $derived(page.status === 404)
	const title = $derived(missing ? m.post_not_found_title() : m.error_title())
</script>

<svelte:head><title>{m.site_page_title({ page: title })}</title></svelte:head>

<PageBar title={m.post_page_title()} back />

<EmptyState {title} body={missing ? m.post_not_found_body() : m.error_body()} />
