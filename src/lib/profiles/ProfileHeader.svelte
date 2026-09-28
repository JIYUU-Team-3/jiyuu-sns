<script lang="ts">
	import { format_month_year } from '#lib/format-date'
	import { getLocale, localizeHref } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { format_count } from '#lib/posts/format'
	import PostText from '#lib/posts/PostText.svelte'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import FollowButton from './FollowButton.svelte'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	const locale = $derived(getLocale())

	/** The header image fell back to the plain fill. */
	let header_broken = $state(false)
</script>

<div class="banner">
	{#if profile.header && !header_broken}
		<img
			src={profile.header}
			alt={m.profile_header_alt({ name: profile.name })}
			onerror={() => (header_broken = true)}
		/>
	{/if}
</div>

<section class="top">
	<div class="head">
		<div class="photo" role="img" aria-label={m.profile_avatar_alt({ name: profile.name })}>
			<Avatar name={profile.name} seed={profile.id} image={profile.image} size={134} />
		</div>
		{#if profile.mine}
			<a class="btn btn-outline" href={localizeHref('/settings/profile')}>{m.profile_edit()}</a>
		{:else}
			<FollowButton {profile} />
		{/if}
	</div>
	<h2 class="name">{profile.name}</h2>
	<div class="handle">
		@{profile.handle}
		{#if profile.follows_you && !profile.mine}
			<span class="pill">{m.follow_follows_you()}</span>
		{/if}
	</div>
	{#if profile.bio}<p class="bio"><PostText body={profile.bio} /></p>{/if}
	<p class="meta">
		<Icon name="calendar" size="sm" />
		<time datetime={new Date(profile.joined_at).toISOString()}
			>{m.profile_joined({ date: format_month_year(profile.joined_at, locale) })}</time
		>
	</p>
	<!-- Plain counts until the follow lists have pages to link to. -->
	<div class="counts num">
		<span><b>{format_count(profile.following, locale)}</b> {m.profile_following()}</span>
		<span><b>{format_count(profile.followers, locale)}</b> {m.profile_followers()}</span>
	</div>
</section>

<style>
	.banner {
		aspect-ratio: 3 / 1;
		background: var(--img-fallback);
		overflow: hidden;
	}
	.banner img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.top {
		padding: 12px 16px 0;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.photo {
		width: max-content;
		margin-top: -80px;
		border: 4px solid var(--bg);
		border-radius: 50%;
		background: var(--bg);
	}
	.name {
		font-size: 20px;
		font-weight: 800;
		margin: 12px 0 0;
		letter-spacing: -0.01em;
		line-height: 1.2;
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
	.meta {
		display: flex;
		align-items: center;
		gap: 4px;
		margin: 12px 0 0;
		color: var(--text-2);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		margin-top: 12px;
		color: var(--text-2);
	}
	.counts b {
		color: var(--text);
	}
	@media (max-width: 700px) {
		.photo {
			margin-top: -52px;
		}
		.photo :global(.av) {
			width: 84px;
			height: 84px;
			font-size: 32px;
		}
	}
</style>
