<script lang="ts" module>
	/** Where this device remembers whether the post was left showing beside the photo. */
	const PANEL_KEY = 'jiyuu-viewer-post'

	/** Storage can be blocked outright (private windows, strict settings); then it just isn't kept. */
	function stored_panel() {
		try {
			return localStorage.getItem(PANEL_KEY) !== '0'
		} catch {
			return true
		}
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte'
	import { beforeNavigate } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import Toast from '#lib/ui/Toast.svelte'
	import { replies_arg } from './args'
	import { hold_autoplay } from './autoplay'
	import Composer from './Composer.svelte'
	import FocusPost from './FocusPost.svelte'
	import PostList from './PostList.svelte'
	import { get_replies } from './posts.remote'
	import { position_label } from './MediaItem.svelte'
	import { deleted_posts, post_content, viewer } from './state.svelte'
	import type { Author } from './types'

	let { me }: { me: Author } = $props()

	const post = $derived(viewer.current?.post)
	const media = $derived(post ? post_content(post).media : [])

	/** The slide on screen, by its place in the post. */
	let index = $state(0)
	/** The post beside the photo, on screens wide enough for it; the arrow folds it away. */
	let panel = $state(true)
	let track = $state<HTMLDivElement>()

	function toggle_panel() {
		panel = !panel
		try {
			localStorage.setItem(PANEL_KEY, panel ? '1' : '0')
		} catch {
			// Not remembered, then.
		}
	}

	const close = () => viewer.close()

	// A link in the post beside the photo leads somewhere else; so does Back.
	beforeNavigate(close)

	$effect(() => {
		if (post && (deleted_posts.has(post.id) || !media.length)) close()
	})

	/** Opening is mounting, as in `Modal`: focus goes back to the photo that was clicked. */
	function show(dialog: HTMLDialogElement) {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
		// Read once: an edit to the post while it's open mustn't open the dialog a second time.
		untrack(() => {
			panel = stored_panel()
			index = Math.min(viewer.current?.index ?? 0, media.length - 1)
		})
		dialog.showModal()
		const release = hold_autoplay()
		return () => {
			release()
			opener?.focus({ preventScroll: true })
		}
	}

	function onscroll() {
		if (track?.clientWidth) index = Math.round(track.scrollLeft / track.clientWidth)
	}

	function step(direction: 1 | -1) {
		track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' })
	}

	function onkeydown(event: KeyboardEvent) {
		// Arrow keys inside the post's own controls, or a video's, are theirs.
		if ((event.target as Element).closest('.info, video')) return
		if (event.key === 'ArrowLeft') step(-1)
		else if (event.key === 'ArrowRight') step(1)
	}

	/** Folding the post away resizes every slide; keep the same one on screen. */
	function keep_slide(node: HTMLDivElement) {
		const observer = new ResizeObserver(() => {
			node.scrollLeft = untrack(() => index) * node.clientWidth
		})
		observer.observe(node)
		return () => observer.disconnect()
	}

	// A video swiped away from stops, rather than playing on unseen.
	$effect(() => {
		const shown = track?.children[index]
		for (const video of track?.querySelectorAll('video') ?? []) {
			if (video.parentElement !== shown) video.pause()
		}
	})
</script>

<!-- Keyed, so a photo opened from a reply beside this one starts the viewer afresh. -->
{#key viewer.current}
	{#if post && media.length}
		<dialog
			aria-label={m.post_viewer_label()}
			{@attach show}
			{onkeydown}
			oncancel={(event) => {
				event.preventDefault()
				close()
			}}
		>
			<div class="stage">
				<div class="track" bind:this={track} {onscroll} {@attach keep_slide}>
					{#each media as item, i (`${i}:${item.url}`)}
						{@const label = item.alt || position_label(item, i + 1, media.length)}
						<div class="slide">
							{#if item.kind === 'video'}
								<!-- svelte-ignore a11y_media_has_caption -->
								<video
									src="{item.url}#t=0.1"
									aria-label={label}
									controls
									loop
									playsinline
									preload="metadata"
								></video>
							{:else}
								<img src={item.url} referrerpolicy="no-referrer" alt={label} decoding="async" />
							{/if}
						</div>
					{/each}
				</div>
				<button type="button" class="ctl close" aria-label={m.composer_close()} onclick={close}>
					<Icon name="x" />
				</button>
				<button
					type="button"
					class="ctl toggle"
					aria-expanded={panel}
					aria-label={panel ? m.post_viewer_hide_post() : m.post_viewer_show_post()}
					title={panel ? m.post_viewer_hide_post() : m.post_viewer_show_post()}
					onclick={toggle_panel}
				>
					<Icon name={panel ? 'chev-right' : 'chev-left'} />
				</button>
				{#if media.length > 1}
					{#if index > 0}
						<button
							type="button"
							class="ctl prev"
							aria-label={m.post_photo_prev()}
							onclick={() => step(-1)}
						>
							<Icon name="chev-left" />
						</button>
					{/if}
					{#if index < media.length - 1}
						<button
							type="button"
							class="ctl next"
							aria-label={m.post_photo_next()}
							onclick={() => step(1)}
						>
							<Icon name="chev-right" />
						</button>
					{/if}
					<span class="count num" aria-hidden="true">{index + 1} / {media.length}</span>
				{/if}
			</div>
			{#if panel}
				<aside class="info">
					<FocusPost {post} media={false} ondeleted={close} />
					{#if post.moderation}
						<!-- A post a moderator hid takes no replies. -->
					{:else if post.can_reply}
						<Composer task={{ kind: 'reply', post }} {me} variant="reply" />
					{:else if post.author.handle}
						<p class="limited">
							<Icon name={post.reply_audience === 'mentioned' ? 'at-sign' : 'user'} size="sm" />
							{post.reply_audience === 'mentioned'
								? m.post_limited_mentioned({ handle: post.author.handle })
								: m.post_limited_following({ handle: post.author.handle })}
						</p>
					{/if}
					<!-- Its own boundary, so the photo opens at once and the replies follow. -->
					<svelte:boundary>
						<PostList
							load={(cursor) => get_replies(replies_arg(post.id, cursor))}
							show_replying={false}
						/>
						{#snippet pending()}
							<p class="loading" role="status">{m.feed_loading()}</p>
						{/snippet}
					</svelte:boundary>
				</aside>
			{/if}
			<!-- A modal dialog covers the page's own toast, so it shows them itself while it's open. -->
			<Toast />
		</dialog>
	{/if}
{/key}

<style>
	dialog {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		border: 0;
		padding: 0;
		background: #000;
		color: inherit;
		overflow: hidden;
	}
	dialog[open] {
		display: flex;
		animation: fade 0.18s ease-out;
	}
	dialog::backdrop {
		background: #000;
	}
	:global(html:has(dialog[open])) {
		overflow: hidden;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.stage {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.track {
		display: flex;
		height: 100%;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		overscroll-behavior: contain;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.slide {
		flex: none;
		width: 100%;
		height: 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}
	/* The whole photo, uncropped, as large as the screen allows. */
	img,
	video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.ctl {
		position: absolute;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(15, 20, 25, 0.72);
		color: #fff;
		backdrop-filter: blur(6px);
		transition: background-color 0.15s;
	}
	.ctl:hover {
		background: rgba(39, 44, 48, 0.85);
	}
	.ctl:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
	.close {
		top: calc(12px + env(safe-area-inset-top));
		left: 12px;
	}
	.toggle {
		top: 12px;
		right: 12px;
	}
	.prev,
	.next {
		top: 50%;
		translate: 0 -50%;
	}
	.prev {
		left: 12px;
	}
	.next {
		right: 12px;
	}
	.count {
		position: absolute;
		left: 50%;
		bottom: calc(12px + env(safe-area-inset-bottom));
		translate: -50% 0;
		padding: 2px 10px;
		border-radius: 12px;
		background: rgba(15, 20, 25, 0.72);
		color: #fff;
		font-size: 13px;
		pointer-events: none;
	}
	.info {
		flex: none;
		width: 380px;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--bg);
		color: var(--text);
		border-left: 1px solid var(--line);
	}
	.limited {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line);
		color: var(--text-2);
		font-size: 14px;
	}
	.loading {
		margin: 0;
		padding: 14px 16px;
		color: var(--text-2);
	}
	/* A phone has no room beside the photo: the post is a tap on Close away. */
	@media (max-width: 700px) {
		.info,
		.toggle {
			display: none;
		}
	}
	/* Swiping does it on a touch screen. */
	@media (hover: none) {
		.prev,
		.next {
			display: none;
		}
	}
</style>
