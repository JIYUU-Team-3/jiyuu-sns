<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { set_follow } from '#lib/profiles/profiles.remote'
	import Avatar from '#lib/ui/Avatar.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import type { UserView } from './types'

	let { user, show_bio = true }: { user: UserView; show_bio?: boolean } = $props()

	/** The row's own follow state, so following from a list doesn't wait for a refetch. */
	let followed = $derived(user.followed)
	let pending = $state(false)

	async function toggle() {
		if (pending) return
		const on = !followed
		followed = on
		pending = true
		try {
			await set_follow({ handle: user.handle, on })
		} catch {
			followed = !on
			toast.show(m.toast_error())
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
		<a class="nm" href={profile_href(user.handle)}>{user.name}</a>
		<div class="hd">@{user.handle}</div>
		{#if show_bio && user.bio}<p class="bio">{user.bio}</p>{/if}
	</div>
	{#if !user.mine}
		<button
			type="button"
			class="btn sm {followed ? 'btn-outline' : 'btn-ink'}"
			aria-label={followed
				? m.follow_unfollow_label({ handle: user.handle })
				: m.follow_follow_label({ handle: user.handle })}
			aria-pressed={followed}
			onclick={toggle}>{followed ? m.follow_following() : m.follow_follow()}</button
		>
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
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bio {
		margin: 4px 0 0;
		overflow-wrap: anywhere;
	}
	.btn {
		margin-top: 2px;
		flex: none;
	}
</style>
