<script lang="ts">
	import { enhance } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_long_date } from '#lib/format-date'
	import { rule_label } from '#lib/moderation/labels'
	import { mod_account_href, mod_post_href } from '#lib/moderation/links'
	import { is_rule } from '#lib/moderation/rules'
	import { profile_href } from '#lib/profiles/links'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import PageBar from '../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	/** The automatic findings on a case, in a moderator's shorthand: `S10`, `nudity 3`, a host. */
	function findings(flags: Record<string, unknown>) {
		const parts: string[] = []
		for (const key of ['text', 'bio'] as const) {
			const codes = flags[key]
			if (Array.isArray(codes) && codes.length) parts.push(`${key}: ${codes.join(', ')}`)
		}
		const images = flags.images
		if (Array.isArray(images)) {
			for (const image of images as { scores?: Record<string, number> }[]) {
				const scores = Object.entries(image.scores ?? {}).filter(([, score]) => score >= 2)
				parts.push(scores.map(([name, score]) => `${name} ${score}`).join(', '))
			}
		}
		const links = flags.links
		if (Array.isArray(links) && links.length) parts.push(`links: ${links.join(', ')}`)
		return parts.filter(Boolean).join(' · ')
	}

	const KIND: Record<'post' | 'profile' | 'message', () => string> = {
		post: m.mod_kind_post,
		profile: m.mod_kind_profile,
		message: m.mod_kind_message,
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.mod_title() })}</title></svelte:head>

<PageBar title={m.mod_title()} />

<section aria-labelledby="reviews-heading">
	<h2 id="reviews-heading">{m.mod_reviews_heading()}</h2>
	{#each data.reviews as review (review.id)}
		<article class="item">
			<p class="meta">
				{#if review.author.handle}
					<a class="lnk" href={mod_account_href(review.author.handle)}>@{review.author.handle}</a>
				{/if}
				· {is_rule(review.action.reason) ? rule_label(review.action.reason) : m.mod_no_reason()}
				{#if review.action.action === 'remove'}
					· <a class="lnk" href={mod_post_href(review.action.target_id)}>{m.mod_review_post()}</a>
				{:else}
					· {review.action.expires_at === null
						? m.mod_permanent()
						: m.mod_until({ date: format_long_date(review.action.expires_at, getLocale()) })}
				{/if}
			</p>
			<p class="text">{review.body}</p>
			<form method="post" action="?/decide" use:enhance>
				<input type="hidden" name="review" value={review.id} />
				{#if review.action.action === 'remove'}
					<button class="btn btn-primary sm" name="decision" value="uphold"
						>{m.mod_review_restore()}</button
					>
					<button class="btn btn-outline sm" name="decision" value="refuse"
						>{m.mod_review_keep_removed()}</button
					>
				{:else}
					<button class="btn btn-primary sm" name="decision" value="uphold"
						>{m.mod_review_uphold()}</button
					>
					<button class="btn btn-outline sm" name="decision" value="refuse"
						>{m.mod_review_refuse()}</button
					>
				{/if}
			</form>
		</article>
	{:else}
		<p class="none">{m.mod_reviews_empty()}</p>
	{/each}
</section>

<section aria-labelledby="cases-heading">
	<h2 id="cases-heading">{m.mod_cases_heading()}</h2>
	{#each data.cases as item (item.id)}
		<article class="item">
			<p class="meta">
				<strong>{KIND[item.kind]()}</strong>
				{#if item.author?.handle}
					· <a class="lnk" href={mod_account_href(item.author.handle)}>@{item.author.handle}</a>
				{/if}
				· {item.reason ? rule_label(item.reason) : m.mod_no_reason()}
				· {m.mod_reports({ count: item.reports })}
			</p>
			{#if findings(item.flags)}
				<p class="meta">{m.mod_findings({ list: findings(item.flags) })}</p>
			{/if}
			{#if !item.exists}
				<p class="text gone">{m.mod_gone()}</p>
			{:else if item.text}
				<p class="text">{item.text}</p>
			{/if}
			<form method="post" action="?/dismiss" use:enhance>
				<input type="hidden" name="case" value={item.id} />
				{#if item.exists && item.kind === 'post'}
					<a class="btn btn-outline sm" href={mod_post_href(item.target_id)}>{m.mod_open()}</a>
				{:else if item.exists && item.kind === 'profile' && item.author?.handle}
					<a class="btn btn-outline sm" href={profile_href(item.author.handle)}>{m.mod_open()}</a>
				{/if}
				<button class="btn btn-outline sm">{m.mod_dismiss()}</button>
			</form>
		</article>
	{:else}
		<EmptyState title={m.mod_cases_empty_title()} body={m.mod_cases_empty_body()} />
	{/each}
</section>

<style>
	section {
		border-bottom: 1px solid var(--line);
	}
	h2 {
		font-size: 17px;
		font-weight: 800;
		padding: 16px 16px 4px;
		margin: 0;
	}
	.item {
		padding: 12px 16px;
		border-top: 1px solid var(--line);
	}
	.meta {
		font-size: 13px;
		color: var(--text-2);
		margin: 0 0 6px;
	}
	.text {
		margin: 0 0 10px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.gone {
		color: var(--text-3);
		font-style: italic;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.none {
		padding: 4px 16px 16px;
		color: var(--text-2);
		margin: 0;
	}
</style>
