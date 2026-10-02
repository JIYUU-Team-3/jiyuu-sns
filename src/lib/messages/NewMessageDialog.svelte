<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import { debounced } from '#lib/posts/composer/debounce.svelte'
	import type { UserView } from '#lib/search/types'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { conversation_href } from './links'
	import { start_conversation } from './messages.remote'
	import PeopleResults from './PeopleResults.svelte'
	import { GROUP_NAME_MAX, MEMBER_MAX } from './rules'

	let { onclose }: { onclose: () => void } = $props()

	let q = $state('')
	let name = $state('')
	let selected = $state<UserView[]>([])
	let pending = $state(false)
	const search = debounced(() => q.trim().replace(/^@/, ''))
	const full = $derived(selected.length >= MEMBER_MAX - 1)

	function toggle(person: UserView) {
		selected = selected.some((p) => p.id === person.id)
			? selected.filter((p) => p.id !== person.id)
			: [...selected, person]
	}

	async function create() {
		if (!selected.length || pending) return
		pending = true
		try {
			const id = await start_conversation({
				user_ids: selected.map((person) => person.id),
				name: selected.length > 1 && name.trim() ? name.trim() : undefined,
			})
			onclose()
			await goto(conversation_href(id))
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			pending = false
		}
	}
</script>

<Modal label={m.dm_new()} onrequestclose={onclose}>
	<div class="head">
		<button type="button" class="icon-btn" aria-label={m.composer_close()} onclick={onclose}>
			<Icon name="x" />
		</button>
		<h2>{m.dm_new()}</h2>
		<button
			type="button"
			class="btn btn-ink sm"
			disabled={!selected.length || pending}
			onclick={create}>{m.dm_next()}</button
		>
	</div>
	<div class="pad">
		<label class="search">
			<Icon name="search" size="sm" />
			<input
				type="search"
				placeholder={m.dm_search_people()}
				aria-label={m.dm_search_people()}
				autocomplete="off"
				data-autofocus
				bind:value={q}
			/>
		</label>
	</div>
	{#if selected.length}
		<div class="chips">
			{#each selected as person (person.id)}
				<span class="chip">
					<Avatar name={person.name} seed={person.id} image={person.image} size={24} />
					{person.name}
					<button
						type="button"
						class="icon-btn"
						aria-label={m.dm_remove_person({ name: person.name })}
						onclick={() => toggle(person)}
					>
						<Icon name="x" size="xs" />
					</button>
				</span>
			{/each}
		</div>
	{/if}
	{#if selected.length > 1}
		<label class="field">
			<span>{m.dm_group_name()}</span>
			<input bind:value={name} maxlength={GROUP_NAME_MAX} />
		</label>
	{/if}
	<div class="results">
		{#if search.current}
			<svelte:boundary>
				<PeopleResults q={search.current} {selected} {full} ontoggle={toggle} />
				{#snippet pending()}
					<p class="note" role="status">{m.composer_picker_loading()}</p>
				{/snippet}
				{#snippet failed()}
					<p class="note">{m.composer_picker_error()}</p>
				{/snippet}
			</svelte:boundary>
		{:else}
			<p class="note">{m.dm_search_hint()}</p>
		{/if}
	</div>
	<p class="hint">{m.dm_group_hint({ count: MEMBER_MAX })}</p>
</Modal>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 16px;
		min-height: 53px;
	}
	h2 {
		flex: 1;
		margin: 0;
		font-size: 20px;
		font-weight: 800;
	}
	.pad {
		padding: 0 16px 8px;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		background: var(--bg-3);
		color: var(--text-2);
	}
	.search:focus-within {
		box-shadow: 0 0 0 1px var(--accent);
		background: var(--bg);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 16px 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 2px 2px 4px;
		border: 1px solid var(--line-2);
		border-radius: 999px;
		font-weight: 600;
		font-size: 14px;
	}
	.chip .icon-btn {
		width: 24px;
		height: 24px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 4px 16px 8px;
		padding: 6px 10px;
		border: 1px solid var(--line-2);
		border-radius: var(--r-sm);
	}
	.field:focus-within {
		border-color: var(--accent);
	}
	.field span {
		font-size: 13px;
		color: var(--text-2);
	}
	.field input {
		border: 0;
		outline: 0;
		background: none;
	}
	.results {
		max-height: 50vh;
		overflow-y: auto;
		border-top: 1px solid var(--line);
	}
	.note {
		margin: 0;
		padding: 16px;
		color: var(--text-2);
	}
	.hint {
		margin: 0;
		padding: 10px 16px 14px;
		font-size: 13px;
		color: var(--text-2);
		border-top: 1px solid var(--line);
	}
</style>
