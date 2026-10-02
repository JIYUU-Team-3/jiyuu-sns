<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'

	/**
	 * Where a review request stands, as three steps: sent, with a moderator, decided. The last step
	 * names both ways it can go, and marks the one it went.
	 */
	let { review, kind }: { review: 'open' | 'upheld' | 'refused'; kind: 'post' | 'suspension' } =
		$props()

	const decided = $derived(review !== 'open')
	const outcomes = $derived(
		kind === 'post'
			? { upheld: m.review_outcome_post_upheld(), refused: m.review_outcome_post_refused() }
			: {
					upheld: m.review_outcome_suspension_upheld(),
					refused: m.review_outcome_suspension_refused(),
				},
	)
</script>

<ol class="steps" aria-label={m.review_status_label()}>
	<li class="done">
		<span class="dot"><Icon name="check" size="xs" /></span>
		<span class="label">{m.review_step_sent()}</span>
	</li>
	<li class={decided ? 'done' : 'active'} aria-current={decided ? undefined : 'step'}>
		<span class="dot"
			>{#if decided}<Icon name="check" size="xs" />{/if}</span
		>
		<span class="label">{m.review_step_reviewing()}</span>
		{#if !decided}<span class="state">{m.review_step_in_progress()}</span>{/if}
	</li>
	<li
		class={review === 'upheld' ? 'done' : review === 'refused' ? 'refused' : 'waiting'}
		aria-current={decided ? 'step' : undefined}
	>
		<span class="dot">
			{#if review === 'upheld'}<Icon name="check" size="xs" />
			{:else if review === 'refused'}<Icon name="x" size="xs" />{/if}
		</span>
		<span class="label">{m.review_step_decision()}</span>
		{#if review !== 'open'}
			<span class="state">{outcomes[review]}</span>
		{:else}
			<span class="state">{m.review_step_either({ a: outcomes.upheld, b: outcomes.refused })}</span>
		{/if}
	</li>
</ol>

<style>
	.steps {
		list-style: none;
		margin: 8px 0;
		padding: 0;
	}
	li {
		position: relative;
		display: grid;
		grid-template-columns: 20px 1fr;
		column-gap: 10px;
		padding-bottom: 14px;
		color: var(--text-2);
	}
	li:last-child {
		padding-bottom: 0;
	}
	/* The line joining one step's dot to the next. */
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 9px;
		top: 20px;
		bottom: 0;
		width: 2px;
		background: var(--line-2);
	}
	li.done:not(:last-child)::before {
		background: var(--accent-fill);
	}
	.dot {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 2px solid var(--line-2);
		border-radius: 50%;
		background: var(--bg);
		color: #fff;
	}
	.label {
		font-weight: 700;
	}
	.state {
		grid-column: 2;
		font-size: 13px;
	}
	.done .dot {
		border-color: var(--accent-fill);
		background: var(--accent-fill);
	}
	.done .label,
	.active .label,
	.refused .label {
		color: var(--text);
	}
	.active .dot {
		border-color: var(--accent-fill);
	}
	.active .dot::after {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-fill);
		animation: pulse 1.4s ease-in-out infinite;
	}
	.active .state {
		color: var(--accent-text);
	}
	.refused .dot {
		border-color: var(--danger-fill);
		background: var(--danger-fill);
	}
	.refused .state {
		color: var(--danger);
	}
	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.active .dot::after {
			animation: none;
		}
	}
</style>
