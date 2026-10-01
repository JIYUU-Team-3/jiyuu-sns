<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { ACCENTS, accent_swatch } from './accents'
	import type { Accent } from './prefs'
	import { prefs } from './prefs.svelte'

	const NAMES: Record<Accent, () => string> = {
		blue: m.settings_accent_blue,
		purple: m.settings_accent_purple,
		pink: m.settings_accent_pink,
		orange: m.settings_accent_orange,
		green: m.settings_accent_green,
	}
</script>

<div class="field">
	<span class="caption" id="accent-label">
		{m.settings_accent()} <span class="name">· {NAMES[prefs.value.accent]()}</span>
	</span>
	<div class="swatches" role="radiogroup" aria-labelledby="accent-label">
		{#each ACCENTS as accent (accent)}
			<label class="swatch" style:--swatch={accent_swatch(accent)} title={NAMES[accent]()}>
				<input
					type="radio"
					name="accent"
					value={accent}
					aria-label={NAMES[accent]()}
					checked={prefs.value.accent === accent}
					onchange={() => prefs.set('accent', accent)}
				/>
				<span class="check"><Icon name="check" size="sm" /></span>
			</label>
		{/each}
	</div>
</div>

<style>
	.field {
		padding: 4px 16px 12px;
	}
	.caption {
		display: block;
		margin-bottom: 10px;
		color: var(--text-2);
		font-size: 14px;
		font-weight: 600;
	}
	.name {
		font-weight: 400;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.swatch {
		position: relative;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--swatch);
		color: #fff;
		cursor: pointer;
		transition: transform 0.15s var(--ease-out);
	}
	.swatch:hover {
		transform: scale(1.06);
	}
	.swatch:has(:checked) {
		box-shadow:
			0 0 0 2px var(--bg),
			0 0 0 4px var(--swatch);
	}
	.swatch:has(:focus-visible) {
		outline: 2px solid var(--text);
		outline-offset: 5px;
	}
	.check {
		display: grid;
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity 0.15s,
			transform 0.2s var(--ease-out);
	}
	.check :global(.ico) {
		stroke-width: 3;
	}
	.swatch:has(:checked) .check {
		opacity: 1;
		transform: none;
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
