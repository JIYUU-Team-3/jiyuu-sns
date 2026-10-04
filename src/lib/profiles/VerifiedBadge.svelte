<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
</script>

<span
	class="verified"
	role="img"
	aria-label={m.verified_developer_badge()}
	title={m.verified_developer_badge()}
>
	<svg viewBox="0 0 24 24" aria-hidden="true">
		<path
			class="seal"
			d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
		/>
		<path class="tick" d="m8.5 12 2.5 2.5 4.5-5" />
	</svg>
</span>

<style>
	.verified {
		display: inline-grid;
		place-items: center;
		flex: none;
		vertical-align: -3px;
	}
	svg {
		width: 16px;
		height: 16px;
	}
	.seal {
		fill: #1a8cd8;
	}
	.tick {
		fill: none;
		stroke: #fff;
		stroke-width: 2.4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
