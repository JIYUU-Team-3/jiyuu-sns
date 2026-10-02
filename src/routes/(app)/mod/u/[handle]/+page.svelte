<script lang="ts">
	import { enhance } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_long_date } from '#lib/format-date'
	import { rule_label } from '#lib/moderation/labels'
	import { RULES, SUSPENSION_DAYS } from '#lib/moderation/rules'
	import { profile_href } from '#lib/profiles/links'
	import PageBar from '../../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	const date = (time: number) => format_long_date(time, getLocale())

	const ACTION: Record<string, () => string> = {
		dismiss: m.mod_action_dismiss,
		warn: m.mod_action_warn,
		sensitive: m.mod_action_sensitive,
		limit: m.mod_action_limit,
		remove: m.mod_action_remove,
		restore: m.mod_action_restore,
		suspend: m.mod_action_suspend,
		unsuspend: m.mod_action_unsuspend,
		block_domain: m.mod_action_block_domain,
		block_media: m.mod_action_block_media,
		restrict: m.mod_action_restrict,
		unrestrict: m.mod_action_unrestrict,
	}
</script>

<svelte:head><title>{m.site_page_title({ page: `@${data.account.handle}` })}</title></svelte:head>

<PageBar title={data.account.name} subtitle="@{data.account.handle}" back />

<div class="page">
	<p>
		<a class="lnk" href={profile_href(data.account.handle)}>{m.mod_view_profile()}</a>
	</p>
	<p>{m.mod_strikes({ recent: data.strikes.recent, total: data.strikes.total })}</p>
	<p>{m.mod_score({ score: data.account.score })}</p>
	{#if !data.account.moderator}
		<form class="row" method="post" action="?/restrict" use:enhance>
			{#if data.account.restricted}
				<p class="note">
					{data.account.restricted_by === 'score'
						? m.mod_restricted_by_score()
						: m.mod_restricted_by_moderator()}
				</p>
				<input type="hidden" name="on" value="0" />
				<button class="btn btn-outline sm">{m.mod_unrestrict()}</button>
			{:else}
				<input type="hidden" name="on" value="1" />
				<button class="btn btn-outline sm">{m.mod_restrict()}</button>
			{/if}
		</form>
	{/if}

	{#if data.account.moderator}
		<p class="note">{m.mod_is_moderator()}</p>
	{:else if data.suspension}
		<p class="note">
			{data.suspension.until === null
				? m.mod_suspended_permanent()
				: m.mod_suspended_until({ date: date(data.suspension.until) })}
		</p>
		<form method="post" action="?/lift" use:enhance>
			<button class="btn btn-primary">{m.mod_lift()}</button>
		</form>
	{:else}
		<h2>{m.mod_suspend_heading()}</h2>
		<form class="suspend" method="post" action="?/suspend" use:enhance>
			<label>
				{m.mod_reason()}
				<select name="reason" required>
					{#each RULES as rule (rule)}
						<option value={rule}>{rule_label(rule)}</option>
					{/each}
				</select>
			</label>
			<label>
				{m.mod_length()}
				<select name="days">
					{#each SUSPENSION_DAYS as days (days)}
						<option value={days ?? 'permanent'}
							>{days === null ? m.mod_permanent() : m.mod_days({ days })}</option
						>
					{/each}
				</select>
			</label>
			<label>
				{m.mod_note()}
				<textarea name="note" rows="3" maxlength="500"></textarea>
			</label>
			{#if form?.invalid}<p class="err">{m.mod_invalid()}</p>{/if}
			<button class="btn btn-danger">{m.mod_suspend()}</button>
		</form>
	{/if}

	<h2>{m.mod_history_heading()}</h2>
	{#each data.history as entry (entry.id)}
		<p class="entry" class:reversed={entry.reversed}>
			<strong>{ACTION[entry.action]?.() ?? entry.action}</strong>
			{#if entry.reason}· {rule_label(entry.reason)}{/if}
			{#if entry.strike}· {m.mod_strike()}{/if}
			· {date(entry.created_at)}
			{#if entry.reversed}· {m.mod_reversed()}{/if}
			{#if entry.note}<br /><span class="said">{entry.note}</span>{/if}
		</p>
	{:else}
		<p class="none">{m.mod_history_empty()}</p>
	{/each}
</div>

<style>
	.page {
		padding: 8px 16px 32px;
	}
	h2 {
		font-size: 17px;
		font-weight: 800;
		margin: 24px 0 8px;
	}
	.note {
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--bg-2);
	}
	.row {
		display: grid;
		gap: 8px;
		justify-items: start;
		margin-bottom: 12px;
	}
	.suspend {
		display: grid;
		gap: 12px;
		justify-items: start;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 700;
		width: 100%;
	}
	select,
	textarea {
		font-weight: 400;
		padding: 8px 10px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
	}
	textarea {
		resize: vertical;
	}
	.err {
		color: var(--danger);
		margin: 0;
	}
	.entry {
		margin: 0;
		padding: 8px 0;
		border-top: 1px solid var(--line);
		font-size: 14px;
	}
	.reversed {
		color: var(--text-3);
	}
	.said {
		color: var(--text-2);
	}
	.none {
		color: var(--text-2);
	}
</style>
