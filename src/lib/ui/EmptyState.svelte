<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		title,
		body,
		children,
	}: {
		title: string
		body: string
		/** An optional action under the text, such as a button. */
		children?: Snippet
	} = $props()
</script>

<div class="empty">
	<h2>{title}</h2>
	<p>{body}</p>
	{#if children}<div class="action">{@render children()}</div>{/if}
</div>

<style>
	.empty {
		padding: 48px 32px;
		max-width: 420px;
		margin: 0 auto;
	}
	h2 {
		font-size: 28px;
		line-height: 1.15;
		font-weight: 800;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}
	p {
		color: var(--text-2);
		margin: 0;
	}
	.action {
		margin-top: 20px;
	}
</style>
