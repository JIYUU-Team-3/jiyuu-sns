<script lang="ts">
	import { host_of } from './blocked'
	import type { LinkPreview } from './types'

	/** Wide pictures (an article's cover) go on top; others are a small square beside the text. */
	const WIDE_MIN_WIDTH = 400
	const WIDE_MIN_RATIO = 1.3

	let {
		link,
		href,
	}: {
		link: LinkPreview
		/** Where the card leads: the link, or the "leaving Jiyuu" page; none in the composer. */
		href?: string
	} = $props()

	const external = $derived(href === link.url)
	const wide = $derived(
		!!link.image &&
			link.image.width >= WIDE_MIN_WIDTH &&
			link.image.width / link.image.height >= WIDE_MIN_RATIO,
	)
</script>

<!-- One link for the whole card, so its text is plain: no links inside a link. -->
<svelte:element
	this={href ? 'a' : 'div'}
	class="card"
	class:wide
	{href}
	target={href && external ? '_blank' : undefined}
	rel={href ? 'noopener noreferrer nofollow ugc' : undefined}
>
	{#if link.image}
		<img src={link.image.url} alt="" loading="lazy" decoding="async" />
	{/if}
	<span class="words">
		<span class="site">{link.site_name ?? host_of(link.url)}</span>
		<span class="title">{link.title}</span>
		{#if link.description}<span class="desc">{link.description}</span>{/if}
	</span>
</svelte:element>

<style>
	.card {
		display: flex;
		align-items: stretch;
		margin-top: 12px;
		border: 1px solid var(--line);
		border-radius: var(--r-md);
		overflow: hidden;
		transition: background-color 0.15s;
		min-width: 0;
	}
	a.card:hover {
		background: var(--bg-2);
	}
	.card.wide {
		flex-direction: column;
	}
	img {
		display: block;
		flex: none;
		width: 96px;
		height: auto;
		min-height: 96px;
		object-fit: cover;
		background: var(--img-fallback);
		border-right: 1px solid var(--line);
	}
	.wide img {
		width: 100%;
		aspect-ratio: 1.91 / 1;
		min-height: 0;
		border-right: 0;
		border-bottom: 1px solid var(--line);
	}
	.words {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		min-width: 0;
		justify-content: center;
	}
	.site {
		font-size: 13px;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title,
	.desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.title {
		font-weight: 600;
		line-height: 1.3;
	}
	.desc {
		font-size: 14px;
		color: var(--text-2);
		line-height: 1.35;
	}
</style>
