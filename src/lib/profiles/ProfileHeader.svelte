<script lang="ts">
	import { format_month_year } from '#lib/format-date'
	import MessageButton from '#lib/messages/MessageButton.svelte'
	import { getLocale, type MessagePart } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { format_count } from '#lib/posts/format'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import NumberRoll from '#lib/ui/NumberRoll.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import FollowButton from './FollowButton.svelte'
	import { edit_profile_href } from './links'
	import ModeratorBadge from '#lib/moderation/ModeratorBadge.svelte'
	import ProfileMenu from './ProfileMenu.svelte'
	import type { ProfileView } from './types'

	let { profile }: { profile: ProfileView } = $props()

	const locale = $derived(getLocale())

	const soon = () => toast.show(m.toast_coming_soon())
</script>

<!-- A label with the count at its `{#count/}` mark, which sits before or after it by language. -->
{#snippet count(parts: MessagePart[], value: number)}
	{#each parts as part, i (i)}
		{#if part.type === 'text'}{part.value}{:else if part.name === 'count'}<b
				><NumberRoll {value} text={format_count(value, locale)} /></b
			>{/if}
	{/each}
{/snippet}

<div class="banner">
	<div class="fill">
		{#if profile.banner}<img src={profile.banner} alt="" />{/if}
	</div>
</div>
<section class="top">
	<div class="head">
		<span class="ring">
			<Avatar name={profile.name} seed={profile.id} image={profile.image} size={134} />
		</span>
		<span class="actions">
			{#if profile.mine}
				<a class="btn btn-outline" href={edit_profile_href()}>{m.profile_edit()}</a>
			{:else}
				<ProfileMenu {profile} />
				{#if !profile.blocked && !profile.blocks_you}
					<MessageButton user_id={profile.id} handle={profile.handle} />
					<FollowButton {profile} />
				{/if}
			{/if}
		</span>
	</div>
	<h2 class="name">
		{profile.name}
		{#if profile.moderator}<ModeratorBadge />{/if}
		{#if profile.private}
			<span class="lock" title={m.profile_private()}>
				<Icon name="lock" size="sm" />
				<span class="label">{m.profile_private()}</span>
			</span>
		{/if}
	</h2>
	<div class="handle">
		@{profile.handle}
		{#if profile.follows_you && !profile.mine}
			<span class="pill">{m.follow_follows_you()}</span>
		{/if}
	</div>
	{#if profile.bio}<p class="bio">{profile.bio}</p>{/if}
	<p class="meta">
		<Icon name="calendar" size="sm" />
		<time datetime={new Date(profile.joined).toISOString()}
			>{m.profile_joined({ date: format_month_year(profile.joined, locale) })}</time
		>
	</p>
	<!-- Keyed so another profile's counts replace these rather than roll from them. -->
	{#key profile.id}
		<div class="counts num">
			<!-- The follow lists don't exist yet. -->
			<button type="button" onclick={soon}
				>{@render count(m.profile_following.parts(), profile.following)}</button
			>
			<button type="button" onclick={soon}
				>{@render count(m.profile_followers.parts(), profile.followers)}</button
			>
		</div>
	{/key}
</section>

<style>
	/*
	 * The avatar's geometry, shared by the ring that places it and the banner's cut-out around
	 * it. The cut-out is a real hole, so it stays right on any page background.
	 */
	.banner,
	.top {
		--pad-x: 16px;
		--pad-top: 12px;
		--av: 134px;
		/* The gap between the avatar and the banner. */
		--gap: 4px;
		/* How far the avatar and its gap rise above the header's top padding. */
		--rise: 80px;
	}
	.banner {
		aspect-ratio: 3 / 1;
		/* The hole's 1px soft edge is centred on its radius, so the gap matches the morph's ring. */
		--hole: calc(var(--av) / 2 + var(--gap));
		mask: radial-gradient(
			circle at calc(var(--pad-x) + var(--gap) + var(--av) / 2)
				calc(100% + var(--pad-top) - var(--rise) + var(--gap) + var(--av) / 2),
			transparent calc(var(--hole) - 0.5px),
			#000 calc(var(--hole) + 0.5px)
		);
	}
	/*
	 * Shared with the edit page, which the banner and avatar morph into (see morph.ts). Named
	 * inside the masked box so the morph carries the banner without its hole.
	 */
	.fill {
		height: 100%;
		background: var(--img-fallback);
		overflow: hidden;
		view-transition-name: profile-banner;
	}
	.ring :global(.av) {
		view-transition-name: profile-avatar;
	}
	.banner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.top {
		position: relative;
		padding: var(--pad-top) var(--pad-x) 12px;
		border-bottom: 1px solid var(--line);
	}
	.head {
		display: flex;
	}
	.actions {
		position: absolute;
		top: var(--pad-top);
		right: var(--pad-x);
		display: flex;
		gap: 8px;
	}
	.ring {
		margin-top: calc(-1 * var(--rise));
		padding: var(--gap);
		display: flex;
	}
	.name {
		font-size: 20px;
		font-weight: 800;
		margin: 12px 0 0;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}
	.lock {
		display: inline-flex;
		vertical-align: -2px;
		margin-left: 4px;
		color: var(--text-2);
	}
	.lock .label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
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
		gap: 20px;
		margin-top: 12px;
		color: var(--text-2);
	}
	.counts button {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	/* The roll's boxes are inline-blocks, which a parent's underline skips; they draw their own. */
	.counts button:hover,
	.counts button:hover :global(:is(.roll, .roll > span)) {
		text-decoration: underline;
	}
	.counts b {
		color: var(--text);
	}
	/* The banner stays 3:1 on phones too, matching its crop, so no edge of the picture is lost. */
	@media (max-width: 700px) {
		.banner,
		.top {
			--av: 84px;
			--rise: 52px;
		}
		/* Avatar sets its size inline, so the phone size overrides the box directly. */
		.top .ring :global(.av) {
			width: var(--av);
			height: var(--av);
			font-size: 32px;
		}
	}
</style>
