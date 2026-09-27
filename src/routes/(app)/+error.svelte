<script lang="ts">
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import PageBar from './PageBar.svelte'

	const missing = $derived(page.status === 404)
	const title = $derived(missing ? m.post_not_found_title() : m.error_title())
</script>

<svelte:head><title>{m.site_page_title({ page: title })}</title></svelte:head>

<PageBar title={m.post_page_title()} back />

<div class="empty">
	<h2>{title}</h2>
	<p>{missing ? m.post_not_found_body() : m.error_body()}</p>
</div>

<style>
	.empty {
		padding: 48px 32px;
		max-width: 420px;
		margin: 0 auto;
	}
	h2 {
		font-size: 28px;
		line-height: 1.15;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	p {
		color: var(--text-2);
		margin: 0;
	}
</style>
