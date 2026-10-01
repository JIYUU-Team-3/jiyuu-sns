<script lang="ts">
	import type { IconName } from '#lib/ui/Icon.svelte'
	import SettingRow from './SettingRow.svelte'

	let {
		icon,
		label,
		sub,
		checked,
		onchange,
	}: {
		icon: IconName
		label: string
		sub?: string
		checked: boolean
		onchange: (checked: boolean) => void
	} = $props()
</script>

<button
	type="button"
	class="row"
	role="switch"
	aria-checked={checked}
	onclick={() => onchange(!checked)}
>
	<SettingRow {icon} {label} {sub}>
		{#snippet end()}<span class="switch" aria-hidden="true"></span>{/snippet}
	</SettingRow>
</button>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		padding: 12px 16px;
		text-align: left;
		transition: background-color 0.15s;
	}
	.row:hover {
		background: var(--bg-2);
	}
	.row:focus-visible {
		outline-offset: -2px;
	}
	.switch {
		position: relative;
		flex: none;
		width: 40px;
		height: 24px;
		border-radius: 12px;
		background: var(--line-2);
		transition: background-color 0.2s;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		transition: transform 0.25s var(--ease-out);
	}
	[aria-checked='true'] .switch {
		background: var(--accent-fill);
	}
	[aria-checked='true'] .switch::after {
		transform: translateX(16px);
	}
</style>
