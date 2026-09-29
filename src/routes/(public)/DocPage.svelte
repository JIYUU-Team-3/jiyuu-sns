<script lang="ts">
	import type { Snippet } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import Mark from './Mark.svelte'
	import SiteFooter from './SiteFooter.svelte'
	import Wordmark from './Wordmark.svelte'
	import { format_long_date } from '#lib/format-date'
	import { localized } from './links'

	/** When the policy pages were last revised. Bump it whenever their text changes. */
	const LAST_UPDATED = Date.UTC(2026, 8, 29)

	let {
		title,
		updated = false,
		children,
	}: { title: string; updated?: boolean; children: Snippet } = $props()

	const last_updated = format_long_date(LAST_UPDATED, getLocale())
</script>

<svelte:head><title>{m.site_page_title({ page: title })}</title></svelte:head>

<header class="doc-head">
	<a class="brand" href={localized('/login')}><Mark size="32px" /><Wordmark /></a>
</header>
<main class="doc">
	<h1>{title}</h1>
	{#if updated}
		<p class="updated">{m.site_last_updated({ date: last_updated })}</p>
	{/if}
	{@render children()}
</main>
<SiteFooter />

<style>
	.doc-head,
	.doc {
		max-width: 600px;
		margin: 0 auto;
	}
	.doc-head {
		padding: 16px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.doc {
		padding: 24px 16px 48px;
	}
	h1 {
		font-size: 28px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 0 0 6px;
	}
	.updated {
		font-size: 13px;
		color: var(--text-2);
		margin: 0 0 24px;
	}
	.doc :global(h2) {
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.01em;
		margin: 32px 0 8px;
	}
	.doc :global(p),
	.doc :global(ul) {
		line-height: 1.55;
		margin: 0 0 12px;
	}
	.doc :global(ul) {
		padding-left: 22px;
	}
	.doc :global(li + li) {
		margin-top: 4px;
	}
	.doc :global(a) {
		color: var(--accent-text);
	}
	.doc :global(a:hover) {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	/* Khmer stacks vowels and subscripts above and below the line, and tight tracking breaks clusters. */
	.doc:lang(km) :global(:is(h1, h2)) {
		line-height: 1.4;
		letter-spacing: normal;
	}
	.doc:lang(km) :global(:is(p, ul)) {
		line-height: 1.75;
	}
</style>
