<script lang="ts">
	import { page } from '$app/state'
	import { IMAGE_ACCEPT, image_problem } from '#lib/media'
	import { refusal_message } from '#lib/moderation/refusals'
	import { m } from '#lib/paraglide/messages.js'
	import { debounced } from '#lib/posts/composer/debounce.svelte'
	import { discard_upload } from '#lib/posts/composer/upload'
	import { profile_href } from '#lib/profiles/links'
	import type { UserView } from '#lib/search/types'
	import Avatar from '#lib/ui/Avatar.svelte'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import Modal from '#lib/ui/Modal.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import ConversationAvatar from './ConversationAvatar.svelte'
	import {
		add_group_members,
		remove_group_member,
		rename_group,
		set_group_admin,
		set_group_photo,
		transfer_group_owner,
	} from './messages.remote'
	import PeopleResults from './PeopleResults.svelte'
	import { can_remove, GROUP_NAME_MAX, MEMBER_MAX } from './rules'
	import type { ConversationView } from './types'
	import { upload_message_photo } from './upload'

	let { convo, onclose }: { convo: ConversationView; onclose: () => void } = $props()

	type Member = ConversationView['members'][number]

	const RANK = { owner: 0, admin: 1, member: 2 }

	// Follows the saved name, but can be typed over.
	let name = $derived(convo.name ?? '')
	let pending = $state(false)
	let file_input = $state<HTMLInputElement>()
	let removing = $state<Member>()
	let transferring = $state<Member>()
	let adding = $state(false)
	let q = $state('')
	let selected = $state<UserView[]>([])
	const search = debounced(() => q.trim().replace(/^@/, ''))

	const me = $derived<Member>({ ...page.data.me, role: convo.role })
	const members = $derived([me, ...convo.members].sort((a, b) => RANK[a.role] - RANK[b.role]))
	const inside = $derived(new Set(convo.members.map((member) => member.id)))
	const room = $derived(MEMBER_MAX - members.length)
	const name_changed = $derived(name.trim() !== (convo.name ?? ''))

	const role_label = (member: Member) =>
		member.role === 'owner'
			? m.dm_role_owner()
			: member.role === 'admin'
				? m.dm_role_admin()
				: undefined

	async function run(action: () => Promise<unknown>) {
		if (pending) return false
		pending = true
		try {
			await action()
			return true
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
			return false
		} finally {
			pending = false
		}
	}

	async function save_name(event: SubmitEvent) {
		event.preventDefault()
		if (!name_changed) return
		if (await run(() => rename_group({ id: convo.id, name: name.trim() })))
			toast.show(m.dm_group_name_saved())
	}

	async function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		input.value = ''
		if (!file) return
		const problem = await image_problem(file, 'message')
		if (problem === 'type') return toast.show(m.onboarding_image_type())
		if (problem === 'size') return toast.show(m.dm_photo_size())
		let url: string | undefined
		const saved = await run(async () => {
			url = await upload_message_photo(file)
			await set_group_photo({ id: convo.id, url })
		})
		if (!saved && url) discard_upload(url)
	}

	function toggle(person: UserView) {
		selected = selected.some((p) => p.id === person.id)
			? selected.filter((p) => p.id !== person.id)
			: [...selected, person]
	}

	function show_members() {
		adding = false
		q = ''
		selected = []
	}

	async function add() {
		if (!selected.length) return
		const user_ids = selected.map((person) => person.id)
		if (await run(() => add_group_members({ id: convo.id, user_ids }))) show_members()
	}

	async function transfer() {
		const member = transferring
		transferring = undefined
		if (member) await run(() => transfer_group_owner({ id: convo.id, user_id: member.id }))
	}

	async function remove() {
		const member = removing
		removing = undefined
		if (member) await run(() => remove_group_member({ id: convo.id, user_id: member.id }))
	}
</script>

<Modal label={m.dm_group_settings()} onrequestclose={onclose}>
	{#if adding}
		<div class="head">
			<button type="button" class="icon-btn" aria-label={m.dm_group_back()} onclick={show_members}>
				<Icon name="back" />
			</button>
			<h2>{m.dm_group_add_people()}</h2>
			<button
				type="button"
				class="btn btn-ink sm"
				disabled={!selected.length || pending}
				onclick={add}>{m.dm_group_add()}</button
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
					bind:value={q}
					{@attach (input) => input.focus()}
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
		<div class="results">
			{#if search.current}
				<svelte:boundary>
					<PeopleResults
						q={search.current}
						{selected}
						full={selected.length >= room}
						exclude={inside}
						ontoggle={toggle}
					/>
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
	{:else}
		<div class="head">
			<button type="button" class="icon-btn" aria-label={m.composer_close()} onclick={onclose}>
				<Icon name="x" />
			</button>
			<h2>{m.dm_group_settings()}</h2>
		</div>

		<div class="identity">
			<ConversationAvatar {convo} large />
			<div class="photo">
				<button
					type="button"
					class="btn btn-outline sm"
					disabled={pending}
					onclick={() => file_input?.click()}
				>
					<Icon name="camera" size="sm" />{m.dm_group_photo_change()}
				</button>
				{#if convo.image}
					<button
						type="button"
						class="btn btn-outline sm"
						disabled={pending}
						onclick={() => run(() => set_group_photo({ id: convo.id }))}
						>{m.dm_group_photo_remove()}</button
					>
				{/if}
			</div>
			<input type="file" accept={IMAGE_ACCEPT} hidden bind:this={file_input} onchange={pick} />
		</div>

		<form class="name" onsubmit={save_name}>
			<label class="field">
				<span>{m.dm_group_name_label()}</span>
				<input bind:value={name} maxlength={GROUP_NAME_MAX} autocomplete="off" />
			</label>
			<button type="submit" class="btn btn-ink sm" disabled={!name_changed || pending}
				>{m.composer_save()}</button
			>
		</form>

		<div class="section">
			<h3>{m.dm_group_members()} · {members.length}</h3>
			<button
				type="button"
				class="btn btn-outline sm"
				disabled={room < 1}
				onclick={() => (adding = true)}
			>
				<Icon name="plus" size="sm" />{m.dm_group_add_people()}
			</button>
		</div>
		<ul class="members">
			{#each members as member (member.id)}
				{@const mine = member.id === me.id}
				{@const promotable = convo.role === 'owner' && member.role !== 'owner'}
				{@const removable = !mine && can_remove(convo.role, member.role)}
				<li class="member">
					<Avatar name={member.name} seed={member.id} image={member.image} />
					<span class="info">
						<span class="nm">
							{#if member.handle}
								<a href={profile_href(member.handle)} onclick={onclose}>{member.name}</a>
							{:else}
								{member.name}
							{/if}
							{#if mine}<span class="you">({m.dm_you()})</span>{/if}
						</span>
						{#if member.handle}<span class="hd">@{member.handle}</span>{/if}
					</span>
					{#if role_label(member)}<span class="role">{role_label(member)}</span>{/if}
					{#if promotable || removable}
						<Menu label={m.dm_member_options({ name: member.name })}>
							{#snippet trigger(props)}
								<button
									type="button"
									class="icon-btn"
									aria-label={m.dm_member_options({ name: member.name })}
									disabled={pending}
									{...props}
								>
									<Icon name="more" />
								</button>
							{/snippet}
							{#snippet children(close)}
								{#if promotable}
									<button
										type="button"
										class="menu-item"
										role="menuitem"
										onclick={() => {
											close()
											void run(() =>
												set_group_admin({
													id: convo.id,
													user_id: member.id,
													on: member.role !== 'admin',
												}),
											)
										}}
									>
										<Icon name="shield" />{member.role === 'admin'
											? m.dm_remove_admin()
											: m.dm_make_admin()}
									</button>
									<button
										type="button"
										class="menu-item"
										role="menuitem"
										onclick={() => {
											close()
											transferring = member
										}}
									>
										<Icon name="user" />{m.dm_transfer_owner()}
									</button>
								{/if}
								{#if removable}
									<button
										type="button"
										class="menu-item danger"
										role="menuitem"
										onclick={() => {
											close()
											removing = member
										}}
									>
										<Icon name="ban" />{m.dm_remove_member()}
									</button>
								{/if}
							{/snippet}
						</Menu>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Modal>

{#if removing}
	<ConfirmDialog
		title={m.dm_remove_member_title({ name: removing.name })}
		body={m.dm_remove_member_body()}
		cta={m.dm_remove_member_cta()}
		onconfirm={remove}
		oncancel={() => (removing = undefined)}
	/>
{/if}

{#if transferring}
	<ConfirmDialog
		title={m.dm_transfer_owner_title({ name: transferring.name })}
		body={m.dm_transfer_owner_body()}
		cta={m.dm_transfer_owner_cta()}
		onconfirm={transfer}
		oncancel={() => (transferring = undefined)}
	/>
{/if}

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
	.identity {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 8px 16px 16px;
	}
	.photo {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 16px 16px;
	}
	.field {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
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
	.section {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-top: 1px solid var(--line);
	}
	h3 {
		margin: 0;
		font-size: 17px;
		font-weight: 800;
	}
	.members {
		list-style: none;
		margin: 0;
		padding: 0 0 8px;
	}
	.member {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 16px;
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
	.nm a:hover {
		text-decoration: underline;
	}
	.you {
		color: var(--text-2);
		font-weight: 400;
	}
	.hd {
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.role {
		flex: none;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--bg-3);
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
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
	.results {
		min-height: 120px;
		max-height: 50vh;
		overflow-y: auto;
		border-top: 1px solid var(--line);
	}
	.note {
		margin: 0;
		padding: 16px;
		color: var(--text-2);
	}
</style>
