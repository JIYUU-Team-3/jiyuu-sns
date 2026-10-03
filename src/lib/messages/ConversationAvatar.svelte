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
	/* Each photo is cut out where the next one overlaps it (a 2px gap), so nothing opaque is
	   painted over a transparent page. Next photo's centre is 62px across, 24px down. */
	.stack :global(.av:not(:last-child)) {
		mask: radial-gradient(circle at 62px 24px, transparent 25.5px, #000 26px);
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
	}
	/* The lower-right photo sits on top; cut a 2px gap around it out of the first. */
	.group :global(.av:first-child) {
		mask: radial-gradient(circle at 29px 29px, transparent 16.5px, #000 17px);
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
