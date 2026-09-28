<script lang="ts">
	import { IMAGE_ACCEPT, type ImageProblem } from '#lib/media'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import ImageCropper from './ImageCropper.svelte'
	import { image_problem_text, PickedImage } from './picked-image.svelte'

	let { image, error }: { image?: string; error?: ImageProblem } = $props()

	const HINT_ID = 'banner-hint'
	const picked = new PickedImage('banner')
	let input: HTMLInputElement
	$effect(() => () => picked.clear())

	/** Set when the stored banner is removed; the server clears it on save. */
	let removed = $state(false)

	/** A newly picked banner, or else the stored one unless it was removed. */
	const shown = $derived(picked.url ?? (removed ? undefined : image))
	const problem = $derived(picked.problem ?? (picked.url ? undefined : error))

	function remove() {
		picked.clear(input)
		if (image) removed = true
	}
</script>

<div class="field">
	<div class="head">
		<span class="lbl">{m.onboarding_banner()}</span>
		{#if shown}
			<button type="button" class="remove" onclick={remove}>
				{m.onboarding_banner_remove()}
			</button>
		{/if}
	</div>
	<div class="banner">
		{#if shown}<img src={shown} alt="" />{/if}
		<button
			type="button"
			class="cam"
			aria-label={m.onboarding_banner_add()}
			aria-describedby={HINT_ID}
			onclick={() => input.click()}
		>
			<Icon name="camera" size="sm" />
		</button>
	</div>
	<p id={HINT_ID} class="hint" class:err={problem} aria-live="polite">
		{problem ? image_problem_text(problem, 'banner') : m.onboarding_banner_hint()}
	</p>
	<input
		bind:this={input}
		type="file"
		name="banner"
		accept={IMAGE_ACCEPT}
		hidden
		onchange={() => picked.pick(input)}
	/>
	{#if removed}<input type="hidden" name="banner_remove" value="1" />{/if}
</div>

{#if picked.cropping}
	<ImageCropper
		src={picked.cropping}
		kind="banner"
		onapply={(blob) => picked.apply(blob)}
		oncancel={() => picked.cancel()}
	/>
{/if}

<style>
	.field {
		margin-bottom: 20px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
	}
	.lbl {
		font-size: 13px;
		color: var(--text-2);
	}
	.remove {
		font-size: 13px;
		color: var(--text-2);
	}
	.remove:hover {
		text-decoration: underline;
	}
	.banner {
		position: relative;
		aspect-ratio: 3 / 1;
		border-radius: 12px;
		overflow: hidden;
		background: var(--img-fallback);
		display: grid;
		place-items: center;
		/* Morphs from the profile page's banner (see morph.ts). */
		view-transition-name: profile-banner;
	}
	.banner img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cam {
		position: relative;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, #000 55%, transparent);
		color: #fff;
	}
	.hint {
		font-size: 13px;
		margin: 6px 0 0;
		color: var(--text-2);
	}
	.hint.err {
		color: var(--danger);
	}
</style>
