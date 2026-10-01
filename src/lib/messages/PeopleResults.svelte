<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { search_people } from '#lib/search/search.remote'
	import type { UserView } from '#lib/search/types'
	import Avatar from '#lib/ui/Avatar.svelte'

	let {
		q,
		selected,
		full,
		ontoggle,
	}: {
		q: string
		selected: UserView[]
		full: boolean
		ontoggle: (person: UserView) => void
	} = $props()

	const people = $derived((await search_people(q)).filter((person) => !person.mine))
	const chosen = $derived(new Set(selected.map((person) => person.id)))
</script>

{#each people as person (person.id)}
	{@const on = chosen.has(person.id)}
	<label class="person">
		<Avatar name={person.name} seed={person.id} image={person.image} />
		<span class="info">
			<span class="nm">{person.name}</span>
			<span class="hd">@{person.handle}</span>
		</span>
		<input
			type="checkbox"
			checked={on}
			disabled={!on && full}
			aria-label={m.dm_select_person({ name: person.name })}
			onchange={() => ontoggle(person)}
		/>
	</label>
{:else}
	<p class="note">{m.dm_no_people()}</p>
{/each}

<style>
	.person {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px 16px;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.person:hover {
		background: var(--bg-2);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}
	.nm {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hd {
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	input {
		width: 20px;
		height: 20px;
		accent-color: var(--accent-fill);
		flex: none;
	}
	.note {
		margin: 0;
		padding: 16px;
		color: var(--text-2);
	}
</style>
