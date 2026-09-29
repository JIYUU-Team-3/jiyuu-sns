<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { format_count, format_time_left } from './format'
	import { vote_poll } from './posts.remote'
	import { current_time, voted_polls } from './state.svelte'
	import type { PollView } from './types'

	let {
		post_id,
		poll: initial,
		mine,
	}: {
		post_id: string
		poll: PollView
		/** The author sees results without voting. */
		mine: boolean
	} = $props()

	const poll = $derived(voted_polls.get(post_id) ?? initial)
	const total = $derived(poll.options.reduce((sum, option) => sum + option.votes, 0))
	const top = $derived(Math.max(...poll.options.map((option) => option.votes)))
	const ended = $derived(poll.ends_at <= current_time())
	// Like X, the author and anyone who voted see results; everyone does once it ends.
	const results = $derived(ended || mine || poll.voted !== undefined)
	let busy = $state(false)

	const percent = (votes: number) => (total ? Math.round((votes / total) * 100) : 0)

	/** Optimistic: results show at once, then settle on what the server counted. */
	async function vote(option: number) {
		if (busy) return
		busy = true
		const before = voted_polls.get(post_id)
		voted_polls.set(post_id, {
			...poll,
			voted: option,
			options: poll.options.map((o, i) => (i === option ? { ...o, votes: o.votes + 1 } : o)),
		})
		try {
			voted_polls.set(post_id, await vote_poll({ id: post_id, option }))
		} catch {
			if (before) voted_polls.set(post_id, before)
			else voted_polls.delete(post_id)
			toast.show(m.toast_error())
		} finally {
			busy = false
		}
	}
</script>

<div class="poll">
	{#each poll.options as option, i (i)}
		{#if results}
			<div class="opt" class:win={option.votes === top && total > 0}>
				<div class="bar" style:--pct={percent(option.votes) / 100}></div>
				<span class="label">
					{option.label}
					{#if poll.voted === i}<Icon name="check-circle" size="sm" />{/if}
				</span>
				<span class="num">{percent(option.votes)}%</span>
			</div>
		{:else}
			<button type="button" class="opt vote" disabled={busy} onclick={() => vote(i)}>
				{option.label}
			</button>
		{/if}
	{/each}
	<div class="meta num">
		{total === 1 ? m.poll_vote_one() : m.poll_votes({ count: format_count(total, getLocale()) })}
		·
		{ended ? m.poll_final() : format_time_left(poll.ends_at, current_time(), getLocale())}
	</div>
</div>

<style>
	.poll {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.opt {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 36px;
		padding: 0 12px;
		border-radius: var(--r-sm);
		overflow: hidden;
		text-align: left;
		width: 100%;
	}
	.vote {
		border: 1px solid var(--accent-fill);
		color: var(--accent-text);
		font-weight: 700;
		justify-content: center;
		border-radius: 999px;
		transition: background-color 0.15s;
	}
	.vote:hover {
		background: var(--accent-soft);
	}
	.bar {
		position: absolute;
		inset: 0;
		background: var(--bg-3);
		border-radius: var(--r-sm);
		transform-origin: left;
		transform: scaleX(var(--pct, 0));
		animation: grow 0.6s var(--ease-out);
	}
	@keyframes grow {
		from {
			transform: scaleX(0);
		}
	}
	.win .bar {
		background: var(--accent-soft-2);
	}
	.label,
	.num {
		position: relative;
	}
	.label {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.win .label {
		font-weight: 700;
	}
	.meta {
		color: var(--text-2);
		font-size: 14px;
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
</style>
