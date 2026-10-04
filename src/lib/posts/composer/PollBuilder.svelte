<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { POLL_DAYS, POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX } from '../rules'
	import type { Draft, DraftPoll } from './draft.svelte'

	let { draft, poll }: { draft: Draft; poll: DraftPoll } = $props()

	const label = (i: number) =>
		i < POLL_MIN_OPTIONS
			? m.composer_poll_choice({ n: i + 1 })
			: m.composer_poll_choice_optional({ n: i + 1 })
</script>

<fieldset class="poll">
	<legend class="sr">{m.composer_add_poll()}</legend>
	{#each poll.options, i (i)}
		<div class="opt">
			<input
				type="text"
				placeholder={label(i)}
				aria-label={label(i)}
				maxlength={POLL_OPTION_MAX}
				bind:value={poll.options[i]}
			/>
			{#if i >= POLL_MIN_OPTIONS}
				<button
					type="button"
					class="icon-btn"
					aria-label={m.composer_poll_remove_choice({ n: i + 1 })}
					onclick={() => draft.remove_poll_option(i)}
				>
					<Icon name="x" size="sm" />
				</button>
			{/if}
		</div>
	{/each}
	{#if poll.options.length < POLL_MAX_OPTIONS}
		<button type="button" class="btn btn-outline sm add" onclick={() => draft.add_poll_option()}>
			<Icon name="plus" size="sm" />{m.composer_poll_add_choice()}
		</button>
	{/if}
	<div class="foot">
		<label>
			{m.composer_poll_length()}
			<select bind:value={poll.days}>
				{#each POLL_DAYS as days (days)}
					<option value={days}
						>{days === 1
							? m.composer_poll_day_one()
							: m.composer_poll_days({ count: days })}</option
					>
				{/each}
			</select>
		</label>
		<button type="button" class="remove" onclick={() => (draft.poll = undefined)}>
			{m.composer_poll_remove()}
		</button>
	</div>
</fieldset>

<style>
	.poll {
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 12px;
		margin: 8px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.opt {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	input {
		flex: 1;
		min-width: 0;
		height: 44px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		padding: 0 12px;
		font: inherit;
		outline: 0;
	}
	input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.add {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: space-between;
		flex-wrap: wrap;
		margin-top: 4px;
		font-size: 14px;
		color: var(--text-2);
	}
	select {
		height: 36px;
		margin-left: 6px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		padding: 0 8px;
	}
	/* iOS zooms the page into a focused field whose text is under 16px. */
	@media (pointer: coarse) {
		input,
		select {
			font-size: 16px;
		}
	}
	.remove {
		color: var(--danger);
		font-weight: 600;
	}
	.remove:hover {
		text-decoration: underline;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
