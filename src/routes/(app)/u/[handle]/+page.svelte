<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { author_arg } from '#lib/posts/args'
	import PostList from '#lib/posts/PostList.svelte'
	import { get_author_posts } from '#lib/posts/posts.remote'
	import ProfileHeader from '#lib/profiles/ProfileHeader.svelte'
	import { get_profile } from '#lib/profiles/profiles.remote'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { params }: PageProps = $props()

	const profile = $derived(await get_profile(params.handle))
</script>

<svelte:head><title>{m.site_page_title({ page: profile.name })}</title></svelte:head>

<PageBar title={profile.name} back />

<ProfileHeader {profile} />

{#key profile.id}
	<PostList load={(cursor) => get_author_posts(author_arg(profile.id, cursor))}>
		{#snippet empty()}
			<div class="empty">
				<h2>{m.profile_posts_empty_title()}</h2>
				<p>{m.profile_posts_empty_body()}</p>
			</div>
		{/snippet}
	</PostList>
{/key}

<style>
	.empty {
		padding: 48px 32px;
		max-width: 420px;
		margin: 0 auto;
	}
	.empty h2 {
		font-size: 28px;
		line-height: 1.15;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	.empty p {
		color: var(--text-2);
		margin: 0;
	}
</style>
