<script lang="ts">
	import { getLocale, isLocale, locales, setLocale, type Locale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'

	const LANGUAGE_NAMES: Record<Locale, string> = { en: 'English', ja: '日本語', km: 'ខ្មែរ' }

	function change_language(event: Event & { currentTarget: HTMLSelectElement }) {
		const { value } = event.currentTarget
		if (isLocale(value)) setLocale(value)
	}
</script>

<label class="auth-lang">
	<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
		<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
	</svg>
	<span class="sr">{m.site_language()}</span>
	<select value={getLocale()} onchange={change_language}>
		{#each locales as locale (locale)}
			<option value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>
		{/each}
	</select>
</label>

<style>
	.auth-lang {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.ico {
		width: 14px;
		height: 14px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	select {
		appearance: none;
		-webkit-appearance: none;
		height: 26px;
		padding: 0 32px 0 4px;
		border: 1px solid transparent;
		border-radius: 8px;
		font: inherit;
		font-size: 13px;
		color: var(--text-2);
		background-color: transparent;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808891' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 8px center;
		background-size: 16px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	select:hover {
		border-color: var(--text-3);
	}
	select:focus-visible {
		outline: 0;
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
</style>
