<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import { autoplay, take_control } from './autoplay'
	import type { Media } from './types'

	let {
		item,
		label,
	}: {
		item: Media
		/** What a video without a description is announced as. */
		label: string
	} = $props()

	let video: HTMLVideoElement
	/** Tapped: sound and native controls are the viewer's now. */
	let manual = $state(false)

	function tap() {
		manual = true
		take_control(video)
	}
</script>

<!-- `#t` makes Safari show the first frame instead of a blank box before it plays. -->
<video
	bind:this={video}
	{@attach autoplay}
	src="{item.url}#t=0.1"
	aria-label={item.alt || label}
	width={item.width}
	height={item.height}
	muted
	loop
	playsinline
	preload="metadata"
></video>
{#if !manual}
	<button type="button" class="tap" aria-label={m.post_video_sound()} onclick={tap}>
		<span class="muted"><Icon name="volume-x" size="xs" /></span>
	</button>
{/if}

<style>
	video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: #000;
	}
	/* The browser's own full screen shows the whole video, not the crop that fills a card. */
	video:fullscreen {
		object-fit: contain;
	}
	video:-webkit-full-screen {
		object-fit: contain;
	}
	/* The whole video is the tap target, so it works anywhere on a phone. */
	.tap {
		position: absolute;
		inset: 0;
		cursor: pointer;
	}
	.tap:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.muted {
		position: absolute;
		right: 10px;
		bottom: 10px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
	}
</style>
