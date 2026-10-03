<script lang="ts">
	import { page } from '$app/state'
	import { getLocale, type Locale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { toast } from '#lib/ui/toasts.svelte'
	import { translatable } from './language'
	import { translate } from './translate.remote'

	let { id, body }: { id: string; body: string } = $props()

	const LANGUAGES: Record<Locale, () => string> = {
		en: m.language_en,
		ja: m.language_ja,
		km: m.language_km,
	}

	const locale = $derived(getLocale())
	/** Offered, as on X, under a post in another language, when the server can translate at all. */
	const offered = $derived(!!page.data.translate && translatable(body, locale))

	let loading = $state(false)
	let shown = $state(false)
	/** Keyed by the text and language it was made for, so an edit or a switch asks again. */
	let result = $state<{ key: string; from: Locale; text: string }>()
	const key = $derived(`${locale}:${body}`)

	async function show() {
		if (result?.key === key) {
			shown = true
			return
		}
		loading = true
		try {
			const translation = await translate({ id, to: locale })
			result = { key, ...translation }
			shown = true
		} catch {
			toast.show(m.post_translate_failed())
		} finally {
			loading = false
		}
	}
</script>

{#if offered}
	{#if shown && result?.key === key}
		<div class="translation" lang={locale}>
			<p class="from">{m.post_translated_from({ language: LANGUAGES[result.from]() })}</p>
			<p class="text">{result.text}</p>
		</div>
		<button type="button" class="link" onclick={() => (shown = false)}>
			{m.post_show_original()}
		</button>
	{:else}
		<button type="button" class="link" disabled={loading} onclick={show}>
			{loading ? m.post_translating() : m.post_translate()}
		</button>
	{/if}
{/if}

<style>
	.link {
		display: block;
		margin-top: 4px;
		padding: 0;
		color: var(--accent-text);
		font-size: 14px;
	}
	.link:hover:not(:disabled) {
		text-decoration: underline;
	}
	.link:disabled {
		color: var(--text-2);
	}
	.translation {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--line);
	}
	.from {
		margin: 0 0 4px;
		color: var(--text-2);
		font-size: 13px;
	}
	.text {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
