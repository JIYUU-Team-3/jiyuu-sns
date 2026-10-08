<script lang="ts">
	import { page } from '$app/state'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_short_date } from '#lib/posts/format'
	import {
		create_api_token,
		get_api_tokens,
		revoke_api_token,
	} from '#lib/settings/api-tokens.remote'
	import SettingsSection from '#lib/settings/SettingsSection.svelte'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import PageBar from '../../PageBar.svelte'

	const keys = $derived(await get_api_tokens())

	let name = $state('')
	let busy = $state(false)
	/** The key just made, shown until it is dismissed; it can't be fetched again. */
	let made = $state<string>()
	let revoking = $state<{ id: string; name: string }>()

	const REFUSALS: Record<string, () => string> = {
		token_new_account: m.api_new_account,
		token_restricted: m.api_restricted,
		tokens_full: m.api_full,
	}

	const example = $derived(
		[
			`curl ${new URL('/api/v1/posts', page.url.origin).href} \\`,
			`  -H "Authorization: Bearer $JIYUU_KEY" \\`,
			`  -H "Content-Type: application/json" \\`,
			`  -d '{"text": "Hello from my agent"}'`,
		].join('\n'),
	)

	const date = (time: Date) => format_short_date(time.getTime(), Date.now(), getLocale())

	async function create(event: SubmitEvent) {
		event.preventDefault()
		busy = true
		try {
			made = (await create_api_token(name)).token
			name = ''
		} catch (error) {
			const message = (error as { body?: { message?: string } }).body?.message ?? ''
			toast.show((REFUSALS[message] ?? m.toast_error)())
		} finally {
			busy = false
		}
	}

	async function copy() {
		if (!made) return
		try {
			await navigator.clipboard.writeText(made)
			toast.show(m.toast_link_copied())
		} catch {
			toast.show(m.toast_error())
		}
	}

	async function revoke() {
		const id = revoking?.id
		revoking = undefined
		if (!id) return
		try {
			await revoke_api_token(id)
		} catch {
			toast.show(m.toast_error())
		}
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.settings_api() })}</title></svelte:head>

<PageBar title={m.settings_api()} back />

<SettingsSection id="api-keys" title={m.api_keys()}>
	<p class="note">{m.api_intro()}</p>
	{#if made}
		<div class="made" role="status">
			<b>{m.api_new_title()}</b>
			<p>{m.api_new_sub()}</p>
			<code class="key">{made}</code>
			<div class="made-actions">
				<button type="button" class="btn btn-primary sm" onclick={copy}>{m.api_copy()}</button>
				<button type="button" class="btn btn-outline sm" onclick={() => (made = undefined)}
					>{m.api_done()}</button
				>
			</div>
		</div>
	{/if}
	<form class="add" onsubmit={create}>
		<input
			type="text"
			bind:value={name}
			placeholder={m.api_name_placeholder()}
			aria-label={m.api_name_placeholder()}
			maxlength={40}
		/>
		<button class="btn btn-ink sm" disabled={busy || !name.trim()}>{m.api_create()}</button>
	</form>
	{#if keys.length}
		<ul>
			{#each keys as key (key.id)}
				<li>
					<span class="what">
						<b>{key.name}</b>
						<span>{m.api_key_meta({ hint: key.hint, date: date(key.created_at) })}</span>
						<span>
							{key.last_used_at
								? m.api_last_used({ date: date(key.last_used_at) })
								: m.api_never_used()}
						</span>
					</span>
					<button
						type="button"
						class="btn btn-outline sm"
						aria-label={m.api_revoke_label({ name: key.name })}
						onclick={() => (revoking = { id: key.id, name: key.name })}>{m.api_revoke()}</button
					>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="note">{m.api_empty()}</p>
	{/if}
</SettingsSection>

<SettingsSection id="api-how" title={m.api_how()}>
	<p class="note">{m.api_how_sub()}</p>
	<pre class="example">{example}</pre>
</SettingsSection>

{#if revoking}
	<ConfirmDialog
		title={m.api_revoke_title({ name: revoking.name })}
		body={m.api_revoke_body()}
		cta={m.api_revoke()}
		onconfirm={revoke}
		oncancel={() => (revoking = undefined)}
	/>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
	}
	.what {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.what b,
	.what span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.what span {
		color: var(--text-2);
		font-size: 14px;
	}
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
	.made {
		margin: 8px 16px;
		padding: 12px;
		border: 1px solid var(--accent);
		border-radius: var(--r-md);
		background: var(--accent-soft);
	}
	.made p {
		margin: 2px 0 8px;
		color: var(--text-2);
		font-size: 14px;
	}
	.key,
	.example {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 13px;
	}
	.key {
		display: block;
		padding: 8px;
		border-radius: var(--r-sm);
		background: var(--bg);
		overflow-wrap: anywhere;
		user-select: all;
	}
	.made-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	.example {
		margin: 0 16px 8px;
		padding: 12px;
		border-radius: var(--r-md);
		background: var(--bg-2);
		overflow-x: auto;
		white-space: pre;
	}
</style>
