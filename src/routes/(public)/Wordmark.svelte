<script lang="ts">
	/** Any CSS length for the font size; 22px when unset, so a parent's CSS can resize it. */
	let { size }: { size?: string } = $props()
</script>

<span class="wordmark" style:font-size={size}>ji<b>Y</b>uu</span>

<style>
	.wordmark {
		font-size: 22px;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--text);
		flex: none;
	}
	.wordmark b {
		color: var(--accent);
		font-weight: 800;
	}
</style>
