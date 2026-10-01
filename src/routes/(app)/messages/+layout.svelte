<script lang="ts">
	import { page } from '$app/state'
	import ConversationList from '#lib/messages/ConversationList.svelte'
	import NewMessageDialog from '#lib/messages/NewMessageDialog.svelte'
	import { new_message } from '#lib/messages/state.svelte'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()
</script>

<div class="dm" class:open={!!page.params.id}>
	<section class="list">
		<ConversationList active={page.params.id} />
	</section>
	<section class="pane">
		{@render children()}
	</section>
</div>

{#if new_message.open}
	<NewMessageDialog onclose={() => new_message.close()} />
{/if}

<style>
	.dm {
		display: flex;
		min-height: 100vh;
	}
	.list {
		width: 390px;
		flex: none;
		border-right: 1px solid var(--line);
	}
	.pane {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		position: sticky;
		top: 0;
	}
	@media (max-width: 1010px) {
		.list {
			width: 100%;
			border: 0;
		}
		.dm:not(.open) .pane,
		.dm.open .list {
			display: none;
		}
	}
</style>
