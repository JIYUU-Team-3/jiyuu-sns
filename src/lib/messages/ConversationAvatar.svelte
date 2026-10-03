<script lang="ts">
	import Avatar from '#lib/ui/Avatar.svelte'
	import type { ConversationView } from './types'

	let { convo, large = false }: { convo: ConversationView; large?: boolean } = $props()

	const first = $derived(convo.members[0])
	const second = $derived(convo.members[1])
</script>

{#if convo.image}
	<Avatar
		name={convo.name ?? first?.name ?? '?'}
		seed={convo.id}
		image={convo.image}
		size={large ? 88 : 44}
	/>
{:else if !second}
	<Avatar
		name={first?.name ?? '?'}
		seed={first?.id ?? convo.id}
		image={first?.image}
		size={large ? 88 : 44}
	/>
{:else if large}
	<span class="stack">
		{#each convo.members.slice(0, 3) as member (member.id)}
			<Avatar name={member.name} seed={member.id} image={member.image} size={48} />
		{/each}
	</span>
{:else}
	<span class="group">
		<Avatar name={first.name} seed={first.id} image={first.image} size={32} />
		<Avatar name={second.name} seed={second.id} image={second.image} size={32} />
	</span>
{/if}

<style>
	.stack {
		display: flex;
		justify-content: center;
	}
	.stack :global(.av) {
		box-shadow: 0 0 0 2px var(--bg);
	}
	.stack :global(.av + .av) {
		margin-left: -10px;
	}
	.group {
		position: relative;
		width: 44px;
		height: 44px;
		flex: none;
	}
	.group :global(.av) {
		position: absolute;
		width: 30px;
		height: 30px;
		font-size: 11px;
		box-shadow: 0 0 0 2px var(--bg);
	}
	.group :global(.av:first-child) {
		top: 0;
		left: 0;
	}
	.group :global(.av:last-child) {
		bottom: 0;
		right: 0;
	}
</style>
