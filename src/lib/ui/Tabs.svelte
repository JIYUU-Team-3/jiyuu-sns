<script lang="ts" generics="T extends string">
	let {
		tabs,
		value = $bindable(),
	}: {
		/** Each tab's value and its label, in order. */
		tabs: [T, () => string][]
		value: T
	} = $props()
</script>

<div class="tabs" role="tablist">
	{#each tabs as [tab, label] (tab)}
		<button
			type="button"
			class="tab"
			role="tab"
			aria-selected={value === tab}
			onclick={() => (value = tab)}>{label()}</button
		>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
	}
	.tab {
		flex: 1;
		display: grid;
		place-items: center;
		height: 52px;
		color: var(--text-2);
		font-weight: 500;
		transition: background-color 0.15s;
		position: relative;
	}
	.tab:hover {
		background: var(--bg-2);
	}
	.tab[aria-selected='true'] {
		color: var(--text);
		font-weight: 700;
	}
	.tab[aria-selected='true']::after {
		content: '';
		position: absolute;
		bottom: 0;
		height: 4px;
		width: 56px;
		border-radius: 2px;
		background: var(--accent);
	}
</style>
