<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon, { type IconName } from '#lib/ui/Icon.svelte'
	import { THEMES, type Theme } from './prefs'
	import { prefs } from './prefs.svelte'

	const OPTIONS: Record<Theme, { icon: IconName; label: () => string }> = {
		system: { icon: 'monitor', label: m.settings_theme_system },
		light: { icon: 'sun', label: m.settings_theme_light },
		dark: { icon: 'moon', label: m.settings_theme_dark },
		daylight: { icon: 'sunrise', label: m.settings_theme_daylight },
	}
</script>

<div class="field">
	<span class="caption" id="theme-label">{m.settings_theme()}</span>
	<div class="seg" role="radiogroup" aria-labelledby="theme-label">
		{#each THEMES as theme (theme)}
			<label class="opt">
				<input
					type="radio"
					name="theme"
					value={theme}
					checked={prefs.value.theme === theme}
					onchange={() => prefs.set('theme', theme)}
				/>
				<Icon name={OPTIONS[theme].icon} size="sm" />
				<span>{OPTIONS[theme].label()}</span>
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
		margin-bottom: 8px;
		color: var(--text-2);
		font-size: 14px;
		font-weight: 600;
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--bg-3);
	}
	.opt {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
		height: 56px;
		padding: 0 4px;
		border-radius: 9px;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}
	.opt span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.opt:hover {
		color: var(--text);
	}
	.opt:has(:checked) {
		background: var(--bg-elev);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}
	.opt:has(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
