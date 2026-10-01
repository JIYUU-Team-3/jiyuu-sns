<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { new_message } from '#lib/messages/state.svelte'
	import EmptyState from '#lib/ui/EmptyState.svelte'
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_messages() })}</title></svelte:head>

<div class="empty">
	<EmptyState title={m.dm_select_title()} body={m.dm_select_body()}>
		<button type="button" class="btn btn-primary" onclick={() => new_message.show()}
			>{m.dm_new()}</button
		>
	</EmptyState>
</div>

<style>
	.empty {
		flex: 1;
		display: grid;
		place-items: center;
	}
</style>
