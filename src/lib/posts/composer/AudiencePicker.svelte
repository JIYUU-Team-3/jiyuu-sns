<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { REPLY_AUDIENCES, type ReplyAudience } from '#lib/safety/rules'
	import Icon, { type IconName } from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'

	let { value = $bindable() }: { value: ReplyAudience } = $props()

	const OPTIONS: Record<ReplyAudience, { icon: IconName; label: () => string }> = {
		everyone: { icon: 'globe', label: m.audience_everyone },
		following: { icon: 'user', label: m.audience_following },
		mentioned: { icon: 'at-sign', label: m.audience_mentioned },
	}
</script>

<Menu label={m.audience_label()} placement="cover-start">
	{#snippet trigger(props)}
		<button type="button" class="pick" {...props}>
			<Icon name={OPTIONS[value].icon} size="sm" />{OPTIONS[value].label()}
		</button>
	{/snippet}
	{#snippet children(close)}
		{#each REPLY_AUDIENCES as option (option)}
			<button
				type="button"
				class="menu-item"
				role="menuitemradio"
				aria-checked={value === option}
				onclick={() => {
					value = option
					close()
				}}
			>
				<Icon name={OPTIONS[option].icon} />{OPTIONS[option].label()}
				{#if value === option}<span class="on"><Icon name="check" size="sm" /></span>{/if}
			</button>
		{/each}
	{/snippet}
</Menu>

<style>
	.pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		margin-left: -10px;
		border-radius: 999px;
		color: var(--accent-text);
		font-size: 14px;
		font-weight: 700;
		transition: background-color 0.15s;
	}
	.pick:hover,
	.pick[aria-expanded='true'] {
		background: var(--accent-soft);
	}
	.on {
		margin-left: auto;
		display: flex;
		color: var(--accent-text);
	}
</style>
