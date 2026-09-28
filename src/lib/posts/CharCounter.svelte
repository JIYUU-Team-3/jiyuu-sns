<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { counter_state, POST_MAX } from './rules'

	let { length }: { length: number } = $props()

	const RADIUS = 9
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS

	const state = $derived(counter_state(length))
	const left = $derived(POST_MAX - length)
	const offset = $derived(CIRCUMFERENCE * (1 - Math.min(length / POST_MAX, 1)))
</script>

<div class="counter">
	<!-- The number only appears near the limit, like X; the ring alone carries it before that. -->
	<span class="n num {state}" aria-hidden="true">{state === 'ok' ? '' : left}</span>
	<svg class="ring {state}" viewBox="0 0 22 22" aria-hidden="true">
		<circle class="track" cx="11" cy="11" r={RADIUS} />
		<circle
			class="val"
			cx="11"
			cy="11"
			r={RADIUS}
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={offset}
		/>
	</svg>
	<span class="sr" aria-live="polite">
		{#if state === 'over'}
			{m.composer_chars_over({ count: -left })}
		{:else if state === 'warn'}
			{m.composer_chars_left({ count: left })}
		{/if}
	</span>
</div>

<style>
	.counter {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.n {
		font-size: 13px;
		color: var(--text-2);
		min-width: 20px;
		text-align: right;
	}
	.n.warn {
		color: var(--warn);
	}
	.n.over {
		color: var(--danger);
		font-weight: 700;
	}
	.ring {
		width: 22px;
		height: 22px;
		transform: rotate(-90deg);
		transition: transform 0.2s var(--ease-out);
	}
	.ring.warn,
	.ring.over {
		transform: rotate(-90deg) scale(1.3);
	}
	circle {
		fill: none;
		stroke-width: 2.4;
	}
	.track {
		stroke: var(--line-2);
	}
	.val {
		stroke: var(--accent);
		transition:
			stroke-dashoffset 0.12s linear,
			stroke 0.15s;
	}
	.warn .val {
		stroke: var(--warn-ring);
	}
	.over .val {
		stroke: var(--danger);
	}
</style>
