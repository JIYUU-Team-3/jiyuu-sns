<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { localized } from '../../(public)/links'

	const LINKS = [
		{ href: localized('/about'), label: m.site_footer_about() },
		{ href: localized('/terms'), label: m.site_footer_terms() },
		{ href: localized('/privacy'), label: m.site_footer_privacy() },
		{ href: localized('/accessibility'), label: m.site_footer_accessibility() },
	]
</script>

<ul>
	{#each LINKS as link (link.href)}
		<li>
			<a href={link.href}>{link.label}<Icon name="chev-right" size="sm" /></a>
		</li>
	{/each}
</ul>
<p class="copy">{m.site_copyright({ year: new Date().getFullYear() })}</p>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 48px;
		padding: 0 16px;
		font-weight: 600;
		transition: background-color 0.15s;
	}
	a:hover {
		background: var(--bg-2);
	}
	a :global(.ico) {
		color: var(--text-2);
	}
	.copy {
		margin: 8px 16px 4px;
		color: var(--text-3);
		font-size: 13px;
	}
</style>
