<script lang="ts">
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { prefs } from '#lib/settings/prefs.svelte'
	import Avatar from '#lib/ui/Avatar.svelte'
	import { format_age } from './format'
	import { post_href } from './links'
	import { current_time } from './state.svelte'
	import type { PostView } from './types'

	/** How many of the quoted post's photos the card shows. */
	const MEDIA_SHOWN = 2

	let {
		quote,
		link = true,
	}: {
		quote: NonNullable<PostView['quote']>
		/** Off in the composer, where the card only shows what is being quoted. */
		link?: boolean
	} = $props()

	const quoted = $derived(quote.post)
	/**
	 * Sensitive media is left off the card unless the viewer shows it at once everywhere; the
	 * quoted post itself has the cover and the Show button.
	 */
	const covered = $derived(
		!!quoted?.sensitive && (!prefs.value.show_sensitive || prefs.value.cover_sensitive),
	)
	const media = $derived(covered ? [] : (quoted?.media.slice(0, MEDIA_SHOWN) ?? []))
</script>

{#if quoted}
	<!-- The whole card is one link, so its text is plain: no links inside a link. -->
	<svelte:element
		this={link ? 'a' : 'div'}
		class="quote"
		href={link ? post_href(quoted.id) : undefined}
	>
		<span class="head">
			<Avatar
				name={quoted.author.name}
				seed={quoted.author.id}
				image={quoted.author.image}
				size={24}
			/>
			<b class="nm">{quoted.author.name}</b>
			{#if quoted.author.handle}<span class="meta">@{quoted.author.handle}</span>{/if}
			<span class="time">· {format_age(quoted.created_at, current_time(), getLocale())}</span>
		</span>
		{#if quoted.body}<span class="text">{quoted.body}</span>{/if}
		{#if covered && quoted.media.length}
			<span class="sensitive">{m.post_sensitive_title()}</span>
		{:else if media.length}
			<span class="media n{media.length}">
				{#each media as item (item.url)}
					{#if item.kind === 'video'}
						<video src="{item.url}#t=0.1" muted playsinline preload="metadata" aria-label={item.alt}
						></video>
					{:else}
						<img src={item.url} alt={item.alt ?? ''} loading="lazy" />
					{/if}
				{/each}
			</span>
		{/if}
	</svelte:element>
{:else}
	<div class="quote gone">{m.post_quote_unavailable()}</div>
{/if}

<style>
	.quote {
		display: block;
		margin-top: 12px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 10px 12px;
		transition: background-color 0.15s;
	}
	a.quote:hover {
		background: var(--bg-2);
	}
	.gone {
		color: var(--text-2);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: 20px;
		min-width: 0;
	}
	.head :global(.av) {
		margin-right: 2px;
	}
	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 0 1 auto;
	}
	.meta {
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.time {
		color: var(--text-2);
		white-space: nowrap;
		flex: none;
	}
	.text {
		display: block;
		margin-top: 2px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.sensitive {
		display: block;
		margin-top: 8px;
		color: var(--text-2);
	}
	.media {
		display: grid;
		gap: 2px;
		margin-top: 8px;
		border-radius: 10px;
		overflow: hidden;
		aspect-ratio: 16 / 9;
	}
	.media.n2 {
		grid-template-columns: 1fr 1fr;
	}
	.media img,
	.media video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		background: var(--img-fallback);
	}
</style>
