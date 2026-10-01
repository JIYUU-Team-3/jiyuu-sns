<script lang="ts">
	import { enhance } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_long_date } from '#lib/format-date'
	import { rule_label } from '#lib/moderation/labels'
	import { mod_account_href } from '#lib/moderation/links'
	import { RULES } from '#lib/moderation/rules'
	import PageBar from '../../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	const post = $derived(data.post)
	const date = (time: number) => format_long_date(time, getLocale())
	/** Flagged media stays blurred for the moderator too, until they choose to look. */
	let show_media = $state(false)

	const STATE: Record<string, () => string> = {
		visible: m.mod_state_visible,
		limited: m.mod_state_limited,
		removed: m.mod_state_removed,
	}
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

<svelte:head><title>{m.site_page_title({ page: m.mod_post_title() })}</title></svelte:head>

<PageBar title={m.mod_post_title()} back />

<div class="page">
	<p class="meta">
		{#if post.handle}
			<a class="lnk" href={mod_account_href(post.handle)}>@{post.handle}</a> ·
		{/if}
		{date(post.created_at)} · <strong>{STATE[post.moderation]()}</strong>
		{#if post.sensitive}· {m.mod_state_sensitive()}{/if}
	</p>

	{#if post.body}<p class="body">{post.body}</p>{/if}

	{#if post.media.length}
		{#if show_media}
			<div class="media">
				{#each post.media as item (item.url)}
					{#if item.kind === 'video'}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video src={item.url} controls preload="none"></video>
					{:else}
						<img src={item.url} alt={item.alt ?? ''} loading="lazy" />
						{#if item.kind === 'image'}
							<form method="post" use:enhance>
								<input type="hidden" name="action" value="block_image" />
								<input type="hidden" name="target" value={item.url} />
								<button class="btn btn-outline sm">{m.mod_block_image()}</button>
							</form>
						{/if}
					{/if}
				{/each}
			</div>
		{:else}
			<button type="button" class="btn btn-outline sm" onclick={() => (show_media = true)}
				>{m.mod_show_media({ count: post.media.length })}</button
			>
		{/if}
	{/if}

	{#if data.hosts.length}
		<h2>{m.mod_links_heading()}</h2>
		<form class="row" method="post" use:enhance>
			<input type="hidden" name="action" value="block_domain" />
			{#each data.hosts as host (host)}
				<button class="btn btn-outline sm" name="target" value={host}
					>{m.mod_block_domain({ domain: host })}</button
				>
			{/each}
		</form>
	{/if}
	{#if form?.blocked}<p class="note" role="status">{m.mod_blocked()}</p>{/if}
	{#if form?.unchanged}<p class="err">{m.mod_unchanged()}</p>{/if}
	{#if form?.invalid}<p class="err">{m.mod_invalid()}</p>{/if}
	{#if form?.suspended}<p class="note">{m.mod_strike_suspended()}</p>{/if}

	<h2>{m.mod_actions_heading()}</h2>
	<form class="row" method="post" use:enhance>
		{#if post.sensitive}
			<button class="btn btn-outline sm" name="action" value="unsensitive"
				>{m.mod_unmark_sensitive()}</button
			>
		{:else}
			<button class="btn btn-outline sm" name="action" value="sensitive"
				>{m.mod_mark_sensitive()}</button
			>
		{/if}
		{#if post.moderation === 'visible'}
			<button class="btn btn-outline sm" name="action" value="limit">{m.mod_limit()}</button>
		{:else}
			<button class="btn btn-primary sm" name="action" value="restore">{m.mod_restore()}</button>
		{/if}
	</form>

	{#if post.moderation !== 'removed'}
		<form class="remove" method="post" use:enhance>
			<input type="hidden" name="action" value="remove" />
			<label>
				{m.mod_reason()}
				<select name="reason" required>
					{#each RULES as rule (rule)}
						<option value={rule}>{rule_label(rule)}</option>
					{/each}
				</select>
			</label>
			<label class="check">
				<input type="checkbox" name="strike" value="no" />
				{m.mod_no_strike()}
			</label>
			<label>
				{m.mod_note()}
				<textarea name="note" rows="2" maxlength="500"></textarea>
			</label>
			<button class="btn btn-danger sm">{m.mod_remove()}</button>
		</form>
	{/if}

	<h2>{m.mod_history_heading()}</h2>
	{#each post.history as entry (entry.id)}
		<p class="entry" class:reversed={entry.reversed}>
			<strong>{ACTION[entry.action]?.() ?? entry.action}</strong>
			{#if entry.reason}· {rule_label(entry.reason)}{/if}
			{#if entry.strike}· {m.mod_strike()}{/if}
			· {date(entry.created_at)}
			{#if entry.reversed}· {m.mod_reversed()}{/if}
		</p>
	{:else}
		<p class="none">{m.mod_history_empty()}</p>
	{/each}
</div>

<style>
	.page {
		padding: 8px 16px 32px;
	}
	.meta {
		font-size: 13px;
		color: var(--text-2);
	}
	.body {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 17px;
	}
	.media {
		display: grid;
		gap: 8px;
	}
	.media img,
	.media video {
		max-width: 100%;
		max-height: 420px;
		border-radius: 12px;
	}
	h2 {
		font-size: 17px;
		font-weight: 800;
		margin: 24px 0 8px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.remove {
		display: grid;
		gap: 10px;
		justify-items: start;
		margin-top: 16px;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 700;
		width: 100%;
	}
	label.check {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	select,
	textarea {
		font-weight: 400;
		padding: 8px 10px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
	}
	.err {
		color: var(--danger);
	}
	.note {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg-2);
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
	.none {
		color: var(--text-2);
	}
</style>
