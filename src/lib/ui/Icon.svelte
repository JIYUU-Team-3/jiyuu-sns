<script lang="ts" module>
	/** Outline icons on a 24px grid, drawn after Lucide geometry (same set as the mockup). */
	const ICONS = {
		home: '<path d="m3 9.5 9-7 9 7V20a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
		compose:
			'<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
		reply: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
		repost:
			'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
		heart:
			'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
		bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
		share:
			'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
		more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
		image:
			'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
		gif: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 10H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2v-2h-1M13 10v4M16.5 14v-4H19M16.5 12H18.5"/>',
		poll: '<path d="M4 6h10M4 12h16M4 18h7"/>',
		pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
		smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
		x: '<path d="M18 6 6 18M6 6l12 12"/>',
		back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
		trash:
			'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
		pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
		logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
		link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
		user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
		camera:
			'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
		calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
	} as const

	export type IconName = keyof typeof ICONS
</script>

<script lang="ts">
	let {
		name,
		size = 'md',
		filled = false,
	}: {
		name: IconName
		/** 24, 20 (default), 16 or 14px. */
		size?: 'lg' | 'md' | 'sm' | 'xs'
		/** The "on" state: a liked heart, a saved bookmark. */
		filled?: boolean
	} = $props()
</script>

<svg class="ico {size}" class:filled viewBox="0 0 24 24" aria-hidden="true">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static path data from the table above -->
	{@html ICONS[name]}
</svg>

<style>
	.ico {
		width: 20px;
		height: 20px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.lg {
		width: 24px;
		height: 24px;
	}
	.sm {
		width: 16px;
		height: 16px;
	}
	.xs {
		width: 14px;
		height: 14px;
	}
	.filled {
		fill: currentColor;
	}
</style>
