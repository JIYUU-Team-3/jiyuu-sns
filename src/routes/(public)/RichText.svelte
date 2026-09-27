<script lang="ts">
	import type { MessagePart } from '#lib/paraglide/runtime'
	import { link_segments } from './rich-text'

	let { parts, hrefs }: { parts: MessagePart[]; hrefs: Record<string, string> } = $props()

	const segments = $derived(link_segments(parts, hrefs))
</script>

<!-- hrefs are already resolved: localized() for app pages, absolute URLs otherwise. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
{#each segments as segment, i (i)}{#if segment.href}<a href={segment.href}>{segment.text}</a
		>{:else}{segment.text}{/if}{/each}
