<script lang="ts" module>
	/** A stable hue per account, so someone without a photo always gets the same colour. */
	export function avatar_hue(seed: string) {
		let hash = 0
		for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
		return Math.abs(hash) % 360
	}

	/** Up to two initials, e.g. `Mika Tanaka` → `MT`. */
	export const initials = (name: string) =>
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => [...word][0])
			.join('')
			.toUpperCase()
</script>

<script lang="ts">
	let {
		name,
		seed,
		image,
		size = 40,
	}: {
		name: string
		/** Anything stable for the account, such as its id. */
		seed: string
		image?: string
		size?: 24 | 32 | 36 | 40 | 44 | 48 | 88
	} = $props()

	/** Set when the photo fails to load, so the initials show instead. */
	let broken = $state(false)
</script>

<span class="av" style:--size="{size}px" style:--h={avatar_hue(seed)} aria-hidden="true">
	{#if image && !broken}
		<!-- Google's photo host can refuse requests that carry a referrer. -->
		<img src={image} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
	{:else}
		{initials(name)}
	{/if}
</span>

<style>
	.av {
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		flex: none;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: hsl(var(--h) var(--av-s) var(--av-l));
		color: hsl(var(--h) 45% var(--av-tl));
		font-weight: 700;
		font-size: calc(var(--size) * 0.38);
		letter-spacing: -0.01em;
		user-select: none;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
