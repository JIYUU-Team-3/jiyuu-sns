<script lang="ts">
	import { enhance } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { rule_label } from './labels'
	import ReviewStatus from './ReviewStatus.svelte'
	import { REVIEW_REQUEST_MAX, type Rule } from './rules'

	/** What a moderator did to the viewer's own post, and the way to ask for a review. */
	let {
		notice,
		form,
	}: {
		notice: {
			action: 'remove' | 'limit'
			reason?: Rule
			note?: string
			review?: 'open' | 'upheld' | 'refused'
			review_until: number | null
		}
		form?: { sent?: boolean; invalid?: boolean; refused?: boolean; body?: string } | null
	} = $props()

	let body = $derived(form?.body ?? '')
	const review = $derived(form?.sent ? 'open' : notice.review)
	const until = $derived(
		notice.review_until === null
			? undefined
			: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
					notice.review_until,
				),
	)
	const open = $derived(notice.review_until !== null && Date.now() < notice.review_until)
</script>

<section class="notice" aria-labelledby="notice-title">
	<h2 id="notice-title">
		{notice.action === 'remove' ? m.post_notice_removed() : m.post_notice_limited()}
	</h2>
	<p>
		{notice.reason ? m.post_notice_rule({ rule: rule_label(notice.reason) }) : ''}
		{notice.action === 'remove' ? m.post_notice_removed_body() : m.post_notice_limited_body()}
	</p>
	{#if notice.note}<p>{m.suspended_note({ note: notice.note })}</p>{/if}

	{#if notice.action === 'remove'}
		{#if review}
			<ReviewStatus {review} kind="post" />
			<p class="status" role="status">
				{review === 'open' ? m.suspended_review_open() : ''}
				{review === 'refused' ? m.post_notice_refused() : ''}
			</p>
		{:else if open && until}
			<form method="post" action="?/review" use:enhance>
				<label for="post-review">{m.post_notice_review({ until })}</label>
				<textarea
					id="post-review"
					name="body"
					rows="3"
					maxlength={REVIEW_REQUEST_MAX}
					required
					bind:value={body}></textarea>
				{#if form?.invalid}
					<p class="err">{m.suspended_review_invalid({ max: REVIEW_REQUEST_MAX })}</p>
				{/if}
				<button class="btn btn-primary sm">{m.suspended_review_send()}</button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.notice {
		margin: 12px 16px;
		padding: 12px 14px;
		border: 1px solid var(--line-2);
		border-radius: 12px;
		background: var(--bg-2);
	}
	h2 {
		font-size: 15px;
		font-weight: 800;
		margin: 0 0 4px;
	}
	p {
		margin: 0 0 8px;
	}
	label {
		display: block;
		font-weight: 700;
		margin: 8px 0 6px;
	}
	textarea {
		width: 100%;
		resize: vertical;
		margin-bottom: 8px;
		padding: 8px 10px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
	}
	.status {
		color: var(--text-2);
	}
	.err {
		color: var(--danger);
	}
</style>
