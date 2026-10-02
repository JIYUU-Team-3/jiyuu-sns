<script lang="ts">
	import type { Snippet } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { block, mute } from '#lib/safety/actions'
	import { normalize_term } from '#lib/safety/rules'
	import {
		answer_request,
		get_safety,
		mute_term,
		set_private,
		unmute_term,
	} from '#lib/safety/safety.remote'
	import type { Account } from '#lib/safety/types'
	import SettingsSection from '#lib/settings/SettingsSection.svelte'
	import SwitchRow from '#lib/settings/SwitchRow.svelte'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import PageBar from '../../PageBar.svelte'

	const lists = $derived(await get_safety())

	let term = $state('')
	let invalid = $state(false)

	async function run(action: () => Promise<unknown>) {
		try {
			await action()
		} catch {
			toast.show(m.toast_error())
		}
	}

	async function add_term(event: SubmitEvent) {
		event.preventDefault()
		if (!normalize_term(term)) {
			invalid = true
			return
		}
		try {
			await mute_term(term)
			term = ''
			invalid = false
		} catch (error) {
			const full = (error as { body?: { message?: string } }).body?.message === 'terms_full'
			toast.show(full ? m.privacy_terms_full() : m.toast_error())
		}
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.settings_privacy() })}</title></svelte:head>

<PageBar title={m.settings_privacy()} back />

{#snippet person(account: Account, actions: Snippet)}
	<li class="person">
		<a class="av" href={profile_href(account.handle)} tabindex="-1" aria-hidden="true">
			<Avatar name={account.name} seed={account.id} image={account.image} />
		</a>
		<a class="who" href={profile_href(account.handle)}>
			<b>{account.name}</b>
			<span>@{account.handle}</span>
		</a>
		{@render actions()}
	</li>
{/snippet}

<SettingsSection id="privacy-account" title={m.settings_account()}>
	<SwitchRow
		icon="lock"
		label={m.profile_private()}
		sub={m.privacy_private_sub()}
		checked={lists.private}
		onchange={(on) => run(() => set_private(on))}
	/>
</SettingsSection>

<SettingsSection id="privacy-requests" title={m.privacy_requests()}>
	{#if lists.requests.length}
		<ul>
			{#each lists.requests as account (account.id)}
				{#snippet actions()}
					<button
						type="button"
						class="btn btn-primary sm"
						onclick={() => run(() => answer_request({ handle: account.handle, approve: true }))}
						>{m.privacy_approve()}</button
					>
					<button
						type="button"
						class="btn btn-outline sm"
						onclick={() => run(() => answer_request({ handle: account.handle, approve: false }))}
						>{m.privacy_decline()}</button
					>
				{/snippet}
				{@render person(account, actions)}
			{/each}
		</ul>
	{:else}
		<p class="none">{m.privacy_requests_empty()}</p>
	{/if}
</SettingsSection>

<SettingsSection id="privacy-terms" title={m.privacy_terms()}>
	<p class="note">{m.privacy_terms_sub()}</p>
	<form class="add" onsubmit={add_term}>
		<input
			type="text"
			bind:value={term}
			placeholder={m.privacy_term_placeholder()}
			aria-label={m.privacy_term_placeholder()}
			aria-invalid={invalid}
			aria-describedby={invalid ? 'term-error' : undefined}
			maxlength={60}
			oninput={() => (invalid = false)}
		/>
		<button class="btn btn-ink sm" disabled={!term.trim()}>{m.privacy_term_add()}</button>
	</form>
	{#if invalid}<p id="term-error" class="error">{m.privacy_term_invalid()}</p>{/if}
	{#if lists.terms.length}
		<ul class="terms">
			{#each lists.terms as muted (muted)}
				<li>
					<span>{muted}</span>
					<button
						type="button"
						class="icon-btn"
						aria-label={m.privacy_term_remove({ term: muted })}
						onclick={() => run(() => unmute_term(muted))}
					>
						<Icon name="x" size="sm" />
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="none">{m.privacy_terms_empty()}</p>
	{/if}
</SettingsSection>

<SettingsSection id="privacy-muted" title={m.privacy_muted()}>
	{#if lists.muted.length}
		<ul>
			{#each lists.muted as account (account.id)}
				{#snippet actions()}
					<button
						type="button"
						class="btn btn-outline sm"
						aria-label={m.safety_unmute({ handle: account.handle })}
						onclick={() => mute(account, false)}>{m.privacy_unmute()}</button
					>
				{/snippet}
				{@render person(account, actions)}
			{/each}
		</ul>
	{:else}
		<p class="none">{m.privacy_muted_empty()}</p>
	{/if}
</SettingsSection>

<SettingsSection id="privacy-blocked" title={m.privacy_blocked()}>
	{#if lists.blocked.length}
		<ul>
			{#each lists.blocked as account (account.id)}
				{#snippet actions()}
					<button
						type="button"
						class="btn btn-outline sm"
						aria-label={m.safety_unblock({ handle: account.handle })}
						onclick={() => block(account, false)}>{m.privacy_unblock()}</button
					>
				{/snippet}
				{@render person(account, actions)}
			{/each}
		</ul>
	{:else}
		<p class="none">{m.privacy_blocked_empty()}</p>
	{/if}
</SettingsSection>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
	}
	.av {
		display: flex;
	}
	.who {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.who b,
	.who span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who span {
		color: var(--text-2);
		font-size: 14px;
	}
	.who:hover b {
		text-decoration: underline;
	}
	.none,
	.note {
		margin: 0;
		padding: 4px 16px 8px;
		color: var(--text-2);
		font-size: 14px;
	}
	.add {
		display: flex;
		gap: 8px;
		padding: 8px 16px;
	}
	.add input {
		flex: 1;
		min-width: 0;
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--line-2);
		border-radius: var(--r-md);
		background: var(--bg);
		color: inherit;
		font: inherit;
	}
	.add input[aria-invalid='true'] {
		border-color: var(--danger);
	}
	.error {
		margin: 0;
		padding: 0 16px 8px;
		color: var(--danger);
		font-size: 14px;
	}
	.terms li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px 4px 16px;
	}
	.terms span {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: 600;
	}
</style>
