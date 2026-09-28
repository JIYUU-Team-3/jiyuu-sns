<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { format_count } from '#lib/posts/format'
	import Avatar from '#lib/ui/Avatar.svelte'
	import FollowButton from './FollowButton.svelte'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	const locale = $derived(getLocale())
</script>

<section class="top">
	<div class="head">
		<Avatar name={profile.name} seed={profile.id} image={profile.image} size={88} />
		{#if !profile.mine}<FollowButton {profile} />{/if}
	</div>
	<h2 class="name">{profile.name}</h2>
	<div class="handle">
		@{profile.handle}
		{#if profile.follows_you && !profile.mine}
			<span class="pill">{m.follow_follows_you()}</span>
		{/if}
	</div>
	{#if profile.bio}<p class="bio">{profile.bio}</p>{/if}
	<div class="counts num">
		<span><b>{format_count(profile.following, locale)}</b> {m.profile_following()}</span>
		<span><b>{format_count(profile.followers, locale)}</b> {m.profile_followers()}</span>
	</div>
</section>

<style>
	.top {
		padding: 16px 16px 12px;
		border-bottom: 1px solid var(--line);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.name {
		font-size: 20px;
		font-weight: 800;
		margin: 12px 0 0;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}
	.handle {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-2);
	}
	.pill {
		font-size: 12px;
		font-weight: 500;
		background: var(--bg-3);
		border-radius: 4px;
		padding: 1px 6px;
		white-space: nowrap;
	}
	.bio {
		margin: 12px 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.counts {
		display: flex;
		gap: 20px;
		margin-top: 12px;
		color: var(--text-2);
	}
	.counts b {
		color: var(--text);
	}
</style>
