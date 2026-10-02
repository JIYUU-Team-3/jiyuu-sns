<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale, locales } from '#lib/paraglide/runtime'
	import Icon from '#lib/ui/Icon.svelte'
	import { LANGUAGE_NAMES } from './languages'
	import { switch_locale } from './locale'

	const current = getLocale()
</script>

<div class="list" role="radiogroup" aria-label={m.settings_language()}>
	{#each locales as locale (locale)}
		<label class="row">
			<input
				type="radio"
				name="language"
				value={locale}
				checked={current === locale}
				onchange={() => switch_locale(locale)}
			/>
			<span class="text" lang={locale}>{LANGUAGE_NAMES[locale]}</span>
			{#if current === locale}<span class="check"><Icon name="check" /></span>{/if}
		</label>
	{/each}
</div>

<style>
	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 48px;
		padding: 0 16px;
		cursor: pointer;
		transition: background-color 0.15s;
	}
	.row:hover {
		background: var(--bg-2);
	}
	.row:has(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.text {
		flex: 1;
		font-weight: 600;
	}
	.check {
		display: grid;
		color: var(--accent-text);
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
