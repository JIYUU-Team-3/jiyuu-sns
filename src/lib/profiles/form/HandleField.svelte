<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import TextField from './TextField.svelte'
	import { HANDLE_MAX, handle_problem, type HandleProblem } from './profile'

	let {
		value = $bindable(''),
		taken,
		current,
		locked = false,
	}: {
		value?: string
		/** A handle the server found held by someone else, flagged until it's edited away. */
		taken?: string
		/** The account's own handle, which it may keep even when reserved. */
		current?: string
		/** A moderator's handle can't change. */
		locked?: boolean
	} = $props()

	const HINT_ID = 'handle-hint'

	const trimmed = $derived(value.trim())
	const problem = $derived(
		trimmed
			? (handle_problem(trimmed, current, locked) ?? (trimmed === taken ? 'taken' : undefined))
			: undefined,
	)

	/** The hint under the field: the rules while empty or fine, otherwise what's wrong. */
	function hint(problem: HandleProblem | undefined, handle: string) {
		if (problem === 'format') return m.onboarding_handle_format()
		if (problem === 'taken') return m.onboarding_handle_taken({ handle })
		if (problem === 'locked') return m.profile_handle_locked()
		return m.onboarding_handle_rules()
	}
</script>

<TextField
	name="handle"
	label={m.onboarding_handle()}
	prefix="@"
	max={HANDLE_MAX}
	invalid={!!problem}
	describedby={HINT_ID}
	bind:value
/>
<p id={HINT_ID} class="hint" class:err={problem} aria-live="polite">{hint(problem, trimmed)}</p>

<style>
	.hint {
		font-size: 13px;
		margin: -10px 0 16px;
		color: var(--text-2);
	}
	.hint.err {
		color: var(--danger);
	}
</style>
