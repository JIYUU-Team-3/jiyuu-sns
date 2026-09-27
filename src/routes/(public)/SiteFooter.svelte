<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import LanguageSelect from './LanguageSelect.svelte'
	import { localized } from './links'

	let { fixed = false }: { fixed?: boolean } = $props()
</script>

<footer class="site-foot" class:fixed>
	<a href={localized('/about')}>{m.site_footer_about()}</a>
	<a href={localized('/terms')}>{m.site_footer_terms()}</a>
	<a href={localized('/privacy')}>{m.site_footer_privacy()}</a>
	<a href={localized('/accessibility')}>{m.site_footer_accessibility()}</a>
	<LanguageSelect />
	<span>{m.site_copyright({ year: new Date().getFullYear() })}</span>
</footer>

<style>
	.site-foot {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 4px 16px;
		padding: 12px 16px;
		font-size: 13px;
		color: var(--text-3);
	}
	.fixed {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
	}
	a:hover {
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
