<script lang="ts">
	/** Any CSS length; the mark is always a circle. */
	let { size = '32px' }: { size?: string } = $props()
</script>

<span class="mark" style:width={size} style:height={size}>
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5.5 12 13l5.5-7.5M12 13v6" /></svg>
</span>

<style>
	.mark {
		display: inline-grid;
		place-items: center;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		flex: none;
	}
	.mark svg {
		width: 56%;
		height: 56%;
		stroke: #fff;
		stroke-width: 3;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
