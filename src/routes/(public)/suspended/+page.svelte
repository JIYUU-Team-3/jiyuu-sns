<script lang="ts">
	import { enhance } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { format_long_date } from '#lib/format-date'
	import { REVIEW_REQUEST_MAX } from '#lib/moderation/rules'
	import { rule_label } from '#lib/moderation/labels'
	import DocPage from '../DocPage.svelte'
	import RichText from '../RichText.svelte'
	import { EXTERNAL_HREFS, localized } from '../links'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	let body = $derived(form?.body ?? '')
	const review = $derived(form?.sent ? 'open' : data.review)
</script>

<DocPage title={m.suspended_title()}>
	<p>
		{data.reason
			? m.suspended_reason({ rule: rule_label(data.reason) })
			: m.suspended_reason_unknown()}
		{data.until === null
			? m.suspended_permanent()
			: m.suspended_until({ date: format_long_date(data.until, getLocale()) })}
	</p>
	{#if data.note}
		<p class="status">{m.suspended_note({ note: data.note })}</p>
	{/if}
	<p><a href={localized('/guidelines')}>{m.suspended_guidelines()}</a></p>

	<h2>{m.suspended_review_heading()}</h2>
	{#if review === 'open'}
		<p class="status" role="status">{m.suspended_review_open()}</p>
	{:else if review === 'refused'}
		<p class="status">{m.suspended_review_refused()}</p>
	{:else}
		<p>{m.suspended_review_hint()}</p>
		<form method="post" action="?/review" use:enhance>
			<label for="review-body">{m.suspended_review_label()}</label>
			<textarea
				id="review-body"
				name="body"
				rows="5"
				maxlength={REVIEW_REQUEST_MAX}
				required
				bind:value={body}></textarea>
			{#if form?.invalid}
				<p class="err">{m.suspended_review_invalid({ max: REVIEW_REQUEST_MAX })}</p>
			{/if}
			<button class="btn btn-primary">{m.suspended_review_send()}</button>
		</form>
	{/if}

	<p><RichText parts={m.suspended_contact.parts()} hrefs={EXTERNAL_HREFS} /></p>

	<form method="post" action="?/signOut">
		<button class="btn btn-outline">{m.suspended_sign_out()}</button>
	</form>
</DocPage>

<style>
	label {
		display: block;
		font-weight: 700;
		margin-bottom: 6px;
	}
	textarea {
		width: 100%;
		resize: vertical;
		margin-bottom: 12px;
		padding: 10px 12px;
		border: 1px solid var(--line-2);
		border-radius: 8px;
		background: var(--bg);
	}
	.status {
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--bg-2);
	}
	.err {
		color: var(--danger);
	}
	form + p,
	p + form {
		margin-top: 24px;
	}
</style>
