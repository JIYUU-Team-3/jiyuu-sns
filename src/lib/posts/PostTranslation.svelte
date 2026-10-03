<script lang="ts">
	import type { Snippet } from 'svelte'
	import { page } from '$app/state'
	import { getLocale, type Locale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { toast } from '#lib/ui/toasts.svelte'
	import { translatable } from './language'
	import { translate } from './translate.remote'

	let {
		id,
		body,
		offer = true,
		text,
	}: {
		id: string
		body: string
		/** Off where a post can't be translated, such as one a moderator hid. */
		offer?: boolean
		/** Draws the post's text: the original, or the translation in its place with its language. */
		text: Snippet<[body: string, lang: Locale | undefined]>
	} = $props()

	const LANGUAGES: Record<Locale, () => string> = {
		en: m.language_en,
		ja: m.language_ja,
		km: m.language_km,
	}

	const locale = $derived(getLocale())
	/** Offered, as on X, under a post in another language, when the server can translate at all. */
	const offered = $derived(offer && !!page.data.translate && translatable(body, locale))

	let loading = $state(false)
	/** Whether the translation stands in for the original right now. */
	let showing = $state<boolean>(false)
	/** Keyed by the text and language it was made for, so an edit or a switch asks again. */
	let result = $state<{ key: string; from: Locale; text: string }>()
	const key = $derived(`${locale}:${body}`)
	const translation = $derived(result?.key === key ? result : undefined)
	const shown = $derived(showing ? translation : undefined)

	async function show() {
		if (translation) {
			showing = true
			return
		}
		loading = true
		try {
			result = { key, ...(await translate({ id, to: locale })) }
			showing = true
		} catch {
			toast.show(m.post_translate_failed())
		} finally {
			loading = false
		}
	}
</script>

{@render text(shown ? shown.text : body, shown ? locale : undefined)}

{#if offered}
	<p class="switch">
		{#if shown}
			<span class="from">{m.post_translated_from({ language: LANGUAGES[shown.from]() })}</span>
			<span class="dot" aria-hidden="true">·</span>
			<button type="button" class="link" onclick={() => (showing = false)}>
				{m.post_show_original()}
			</button>
		{:else}
			<!-- A translation already fetched comes back at once; only the first one asks. -->
			<button type="button" class="link" disabled={loading} onclick={show}>
				{loading
					? m.post_translating()
					: translation
						? m.post_show_translation()
						: m.post_translate()}
			</button>
		{/if}
	</p>
{/if}

<style>
	.switch {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 4px;
		margin: 4px 0 0;
		font-size: 14px;
	}
	.from,
	.dot {
		color: var(--text-2);
	}
	.link {
		padding: 0;
		color: var(--accent-text);
		font-size: inherit;
	}
	.link:hover:not(:disabled) {
		text-decoration: underline;
	}
	.link:disabled {
		color: var(--text-2);
	}
</style>
