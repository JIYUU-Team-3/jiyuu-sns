<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { avatar_hue, initials } from './profile'

	let { name, seed, image }: { name: string; seed: string; image?: string } = $props()

	/** Set when the Google photo fails to load, so the initials show instead. */
	let broken = $state(false)
</script>

<div class="photo">
	<div class="avwrap">
		<span class="av" style:--h={avatar_hue(seed)} aria-hidden="true">
			{#if image && !broken}
				<!-- Google's photo host can refuse requests that carry a referrer. -->
				<img src={image} alt="" referrerpolicy="no-referrer" onerror={() => (broken = true)} />
			{:else}
				{initials(name)}
			{/if}
		</span>
		<button type="button" class="cam" disabled aria-label={m.onboarding_photo_change()}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"
				/>
				<circle cx="12" cy="13" r="3" />
			</svg>
		</button>
	</div>
	<p>
		{m.onboarding_photo_default()}<br />
		{m.onboarding_photo_soon()}
	</p>
</div>

<style>
	.photo {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-bottom: 24px;
	}
	.avwrap {
		position: relative;
		flex: none;
	}
	.av {
		--size: 96px;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
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
	.av img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cam {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 2px solid var(--bg);
		border-radius: 50%;
		background: var(--text);
		color: var(--bg);
	}
	/* Upload isn't built yet: the button stays visible so the layout matches the design. */
	.cam:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.cam svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	p {
		margin: 0;
		font-size: 14px;
		color: var(--text-2);
	}
</style>
