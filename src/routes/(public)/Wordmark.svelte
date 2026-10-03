<script lang="ts">
	import { LOGO_Y } from '#lib/ui/logo'

	/** Any CSS length for the font size; 22px when unset, so a parent's CSS can resize it. */
	let { size }: { size?: string } = $props()
</script>

<!--
	The Y is Segoe UI Black's outline, drawn rather than typed, so it is the same shape on every
	device and matches the favicon and the push icon. The hidden Y keeps the name whole for screen
	readers and copying.
-->
<span class="wordmark" style:font-size={size}
	>ji<b
		><svg viewBox="0 0 {LOGO_Y.width} {LOGO_Y.height}" aria-hidden="true"
			><path transform="matrix(1 0 0 -1 0 {LOGO_Y.height})" d={LOGO_Y.path} /></svg
		><span class="text">Y</span></b
	>uu</span
>

<style>
	.wordmark {
		font-size: 22px;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--text);
		flex: none;
	}
	b {
		display: inline-block;
		/* The letter-spacing the typed Y had. */
		margin-right: -0.02em;
	}
	/* Segoe UI's cap height and the Y's width, in ems, so it stands as tall as the letters beside it. */
	svg {
		display: block;
		height: 0.7em;
		width: 0.65em;
		fill: var(--accent);
	}
	.text {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
