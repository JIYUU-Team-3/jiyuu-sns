<script lang="ts">
	import type { Snippet } from 'svelte'
	import { refusal_message } from '#lib/moderation/refusals'
	import { m } from '#lib/paraglide/messages.js'
	import FollowControl from '#lib/profiles/FollowControl.svelte'
	import { profile_href } from '#lib/profiles/links'
	import { set_follow } from '#lib/profiles/profiles.remote'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import ModeratorBadge from '#lib/moderation/ModeratorBadge.svelte'
	import type { UserView } from './types'

	let {
		user,
		show_bio = true,
		show_follows_you = true,
		menu,
	}: {
		user: UserView
		show_bio?: boolean
		/** Off where everyone listed follows the viewer, such as your own followers. */
		show_follows_you?: boolean
		/** More actions for this account, before its follow button. */
		menu?: Snippet
	} = $props()

	/** The row's own follow state, so following from a list doesn't wait for a refetch. */
	let followed = $derived(user.followed)
	let requested = $derived(user.requested)
	let pending = $state(false)

	const active = $derived(followed || requested)

	async function toggle() {
		const on = !active
		const before = { followed, requested }
		if (requested || (on && user.private)) requested = on
		else followed = on
		pending = true
		try {
			await set_follow({ handle: user.handle, on })
		} catch (cause) {
			followed = before.followed
			requested = before.requested
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			pending = false
		}
	}
</script>

<div class="urow">
	<a href={profile_href(user.handle)} class="av" tabindex="-1" aria-hidden="true">
		<Avatar name={user.name} seed={user.id} image={user.image} />
	</a>
	<div class="info">
		<a class="nm" href={profile_href(user.handle)}>
			{user.name}
			{#if user.moderator}<ModeratorBadge />{/if}
		</a>
		<div class="hd">
			<span class="at">@{user.handle}</span>
			{#if show_follows_you && user.follows_you && !user.mine}<span class="pill"
					>{m.follow_follows_you()}</span
				>{/if}
		</div>
		{#if user.location}
			<div class="loc"><Icon name="pin" size="xs" /><span>{user.location}</span></div>
		{/if}
		{#if show_bio && user.bio}<p class="bio">{user.bio}</p>{/if}
	</div>
	{@render menu?.()}
	{#if !user.mine}
		<FollowControl
			handle={user.handle}
			{followed}
			{requested}
			follows_you={user.follows_you}
			{pending}
			small
			ontoggle={toggle}
		/>
	{/if}
</div>

<style>
	.urow {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 12px 16px;
		transition: background-color 0.15s;
	}
	.urow:hover {
		background: var(--bg-2);
	}
	.av {
		display: flex;
	}
	.info {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}
	.nm {
		display: block;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm:hover {
		text-decoration: underline;
	}
	.hd {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-2);
	}
	.at {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pill {
		flex: none;
		font-size: 12px;
		font-weight: 500;
		background: var(--bg-3);
		border-radius: 4px;
		padding: 1px 6px;
		white-space: nowrap;
	}
	.loc {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		color: var(--text-2);
		font-size: 13px;
		min-width: 0;
	}
	.loc span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bio {
		margin: 4px 0 0;
		overflow-wrap: anywhere;
	}
	.urow > :global(.follow) {
		margin-top: 2px;
	}
</style>
