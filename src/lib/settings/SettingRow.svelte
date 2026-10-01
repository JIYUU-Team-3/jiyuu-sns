<script lang="ts">
	import type { Snippet } from 'svelte'
	import Icon, { type IconName } from '#lib/ui/Icon.svelte'

	let {
		icon,
		label,
		sub,
		end,
	}: {
		icon: IconName
		label: string
		/** A quieter line under the label. */
		sub?: string
		/** Whatever sits at the row's end: a switch, a chevron. */
		end?: Snippet
	} = $props()
</script>

<span class="ico"><Icon name={icon} /></span>
<span class="text">
	<span class="label">{label}</span>
	{#if sub}<span class="sub">{sub}</span>{/if}
</span>
{@render end?.()}

<style>
	.ico {
		display: grid;
		color: var(--text-2);
	}
	.text {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.label {
		display: block;
		font-weight: 600;
	}
	.sub {
		display: block;
		margin-top: 2px;
		color: var(--text-2);
		font-size: 14px;
		overflow-wrap: anywhere;
	}
</style>
