<script lang="ts">
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import ConversationList from '#lib/messages/ConversationList.svelte'
	import NewMessageDialog from '#lib/messages/NewMessageDialog.svelte'
	import { new_message } from '#lib/messages/state.svelte'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()

	const KEYBOARD_MIN = 120

	let viewport = $state<{ height: number; top: number; keyboard: boolean }>()

	onMount(() => {
		const visual = window.visualViewport
		if (!visual) return
		const sync = () => {
			viewport = {
				height: visual.height,
				top: visual.offsetTop,
				keyboard: window.innerHeight - visual.height > KEYBOARD_MIN,
			}
		}
		sync()
		visual.addEventListener('resize', sync)
		visual.addEventListener('scroll', sync)
		return () => {
			visual.removeEventListener('resize', sync)
			visual.removeEventListener('scroll', sync)
		}
	})
</script>

<div class="dm" class:open={!!page.params.id}>
	<section class="list">
		<ConversationList active={page.params.id} />
	</section>
	<section
		class="pane"
		class:keyboard={viewport?.keyboard}
		style:--viewport-height={viewport && `${viewport.height}px`}
		style:--viewport-top={viewport && `${viewport.top}px`}
	>
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
	@media (max-width: 700px) {
		.dm.open .pane {
			position: fixed;
			left: 0;
			right: 0;
			top: var(--viewport-top, 0px);
			height: var(--viewport-height, 100dvh);
		}
		.pane.keyboard {
			--chat-inset: 0px;
		}
		:global(html:has(.dm.open)) {
			overflow: hidden;
		}
	}
</style>
