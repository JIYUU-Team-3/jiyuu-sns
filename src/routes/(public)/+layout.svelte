<script lang="ts">
	let { children } = $props()
</script>

<div class="public">{@render children()}</div>

<style>
	/* Kantumruy Pro, restricted to the Khmer block so Latin and Japanese keep the system stack. */
	@font-face {
		font-family: 'Kantumruy Khmer';
		font-style: normal;
		font-display: swap;
		font-weight: 100 700;
		src: url('@fontsource-variable/kantumruy-pro/files/kantumruy-pro-khmer-wght-normal.woff2')
			format('woff2-variations');
		unicode-range: U+1780-17FF, U+19E0-19FF, U+200C-200D, U+25CC;
	}

	/* Design tokens from design/mockup/index.html, limited to what these pages use.
	   There is no global stylesheet yet, so they apply only while a page of this group is shown. */
	:global(:root:has(.public)) {
		--bg: #ffffff;
		--bg-2: #f7f8f9;
		--line: #e6e8eb;
		--line-2: #cfd5da;
		--text: #0f1419;
		--text-2: #536471;
		--text-3: #6b7885;
		--accent: #1d9bf0;
		--accent-text: #0070c9;
		--accent-fill: #0070c9;
		--accent-fill-hover: #005ea9;
		--on-accent: #ffffff;
		--danger: #d92c2c;
		--av-l: 88%;
		--av-s: 55%;
		--av-tl: 28%;
		--font:
			'Kantumruy Khmer', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
			Arial, 'Noto Sans', 'Noto Sans JP', 'Noto Sans Khmer', sans-serif;
		color-scheme: light;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root:has(.public)) {
			--bg: #161618;
			--bg-2: #1d1d20;
			--line: #2c2c31;
			--line-2: #3d3d44;
			--text: #ececef;
			--text-2: #9a9aa3;
			--text-3: #8b8b94;
			--accent-text: #4cb0f5;
			--accent-fill: #0a6fcf;
			--accent-fill-hover: #1a7fdd;
			--danger: #f4575a;
			--av-l: 28%;
			--av-s: 28%;
			--av-tl: 84%;
			color-scheme: dark;
		}
	}
	:global(body:has(.public)) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font: 15px/1.4 var(--font);
		-webkit-font-smoothing: antialiased;
	}
	.public,
	.public :global(*) {
		box-sizing: border-box;
	}
	.public :global(a) {
		color: inherit;
		text-decoration: none;
	}
	.public :global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 6px;
	}
</style>
