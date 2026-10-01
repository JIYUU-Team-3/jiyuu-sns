<script lang="ts">
	import '../app.css'
	import { untrack } from 'svelte'
	import type { Path } from '$app/types'
	import { browser } from '$app/env'
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import { locales, localizeHref } from '#lib/paraglide/runtime'
	import { accent_style, prefs } from '#lib/settings/prefs.svelte'
	import { clip_under_bars } from '#lib/settings/clear.svelte'
	import { reload_if_stale_locale } from '#lib/settings/locale'
	import favicon from '#lib/assets/favicon.svg'

	let { data, children } = $props()

	if (browser) prefs.init(untrack(() => data.prefs))
	if (browser) reload_if_stale_locale()

	clip_under_bars()
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- generated from a whitelisted accent -->
	{@html accent_style()}
</svelte:head>
<svelte:window onpageshow={reload_if_stale_locale} />
{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
	{/each}
</div>
