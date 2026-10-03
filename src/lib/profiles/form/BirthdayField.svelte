<script lang="ts">
	import { month_names } from '#lib/format-date'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { AUDIENCES, FIRST_YEAR, type Audience, type BirthdayProblem } from '../details'

	let {
		date,
		day_audience,
		year_audience,
		error,
	}: {
		/** The saved `YYYY-MM-DD`, or null. */
		date: string | null
		day_audience: Audience
		year_audience: Audience
		error?: BirthdayProblem
	} = $props()

	// Split as it is, not checked, so a rejected date like 31 February keeps the picks that made it.
	const saved = $derived((date ?? '').split('-').map((part) => String(Number(part) || '')))
	// Writable deriveds: prefilled from what's saved, then the form's own.
	let year = $derived(saved[0] ?? '')
	let month = $derived(saved[1] ?? '')
	let day = $derived(saved[2] ?? '')

	const MONTHS = $derived(month_names(getLocale()))
	const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
	const YEARS = Array.from(
		{ length: new Date().getFullYear() - FIRST_YEAR + 1 },
		(_, i) => new Date().getFullYear() - i,
	)

	const AUDIENCE_LABELS: Record<Audience, () => string> = {
		everyone: m.profile_audience_everyone,
		followers: m.profile_audience_followers,
		only_me: m.profile_audience_only_me,
	}

	const ERRORS: Record<BirthdayProblem, () => string> = {
		invalid: m.profile_birthday_invalid,
		too_young: m.profile_birthday_too_young,
	}
</script>

<fieldset class="birthday" class:err={!!error}>
	<legend>{m.profile_birthday()}</legend>
	<div class="row">
		<label class="pick month">
			<span class="lbl">{m.profile_birthday_month()}</span>
			<select name="birth_month" bind:value={month}>
				<option value="">—</option>
				{#each MONTHS as name, i (i)}<option value={String(i + 1)}>{name}</option>{/each}
			</select>
		</label>
		<label class="pick">
			<span class="lbl">{m.profile_birthday_day()}</span>
			<select name="birth_day" bind:value={day}>
				<option value="">—</option>
				{#each DAYS as d (d)}<option value={String(d)}>{d}</option>{/each}
			</select>
		</label>
		<label class="pick">
			<span class="lbl">{m.profile_birthday_year()}</span>
			<select name="birth_year" bind:value={year}>
				<option value="">—</option>
				{#each YEARS as y (y)}<option value={String(y)}>{y}</option>{/each}
			</select>
		</label>
	</div>
	{#if error}<p class="msg" role="alert">{ERRORS[error]()}</p>{/if}

	<div class="row">
		<label class="pick">
			<span class="lbl">{m.profile_birthday_day_audience()}</span>
			<select name="birthday_audience" value={day_audience}>
				{#each AUDIENCES as a (a)}<option value={a}>{AUDIENCE_LABELS[a]()}</option>{/each}
			</select>
		</label>
		<label class="pick">
			<span class="lbl">{m.profile_birthday_year_audience()}</span>
			<select name="birth_year_audience" value={year_audience}>
				{#each AUDIENCES as a (a)}<option value={a}>{AUDIENCE_LABELS[a]()}</option>{/each}
			</select>
		</label>
	</div>
	<p class="hint">{m.profile_birthday_hint()}</p>
</fieldset>

<style>
	.birthday {
		border: 0;
		margin: 0 0 16px;
		padding: 0;
	}
	legend {
		font-weight: 700;
		font-size: 15px;
		padding: 0;
		margin-bottom: 8px;
	}
	.row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	.pick {
		flex: 1 1 0;
		min-width: 0;
		display: block;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		padding: 6px 10px 8px;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.month {
		flex-grow: 1.6;
	}
	.pick:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
	.err .row:first-of-type .pick {
		border-color: var(--danger);
	}
	.lbl {
		display: block;
		font-size: 13px;
		color: var(--text-2);
	}
	.pick:focus-within .lbl {
		color: var(--accent-text);
	}
	select {
		width: 100%;
		border: 0;
		outline: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 17px;
		padding: 2px 0;
	}
	select:focus-visible {
		outline: none;
	}
	option {
		background: var(--bg-elev);
		color: var(--text);
	}
	.msg {
		margin: 0 0 8px;
		color: var(--danger);
		font-size: 13px;
	}
	.hint {
		margin: 0;
		color: var(--text-2);
		font-size: 13px;
	}
</style>
