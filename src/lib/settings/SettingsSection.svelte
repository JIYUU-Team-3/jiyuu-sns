<script lang="ts">
	import type { Snippet } from 'svelte'

	let { id, title, children }: { id: string; title: string; children: Snippet } = $props()
</script>

<section class="section" aria-labelledby={id}>
	<h2 {id}>{title}</h2>
	{@render children()}
</section>

<style>
	.section {
		padding: 4px 0 12px;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		margin: 0;
		padding: 16px 16px 8px;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
</style>
