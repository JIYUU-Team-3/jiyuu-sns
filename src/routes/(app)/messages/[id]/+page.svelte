<script lang="ts">
	import Chat from '#lib/messages/Chat.svelte'
	import { messages_href } from '#lib/messages/links'
	import { m } from '#lib/paraglide/messages.js'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import type { PageProps } from './$types'

	let { params }: PageProps = $props()
</script>

{#key params.id}
	<svelte:boundary>
		<Chat id={params.id} />
		{#snippet pending()}
			<div class="center" role="status" aria-label={m.composer_picker_loading()}></div>
		{/snippet}
		{#snippet failed()}
			<div class="center">
				<EmptyState title={m.dm_not_found_title()} body={m.dm_not_found_body()}>
					<a class="btn btn-primary" href={messages_href()}>{m.app_messages()}</a>
				</EmptyState>
			</div>
		{/snippet}
	</svelte:boundary>
{/key}

<style>
	.center {
		flex: 1;
		display: grid;
		place-items: center;
	}
</style>
