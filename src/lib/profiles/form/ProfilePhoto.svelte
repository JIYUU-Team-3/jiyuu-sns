<script lang="ts">
	import { IMAGE_ACCEPT, type ImageProblem } from '#lib/media'
	import { m } from '#lib/paraglide/messages.js'
	import Icon from '#lib/ui/Icon.svelte'
	import ImageCropper from './ImageCropper.svelte'
	import { image_problem_text, PickedImage } from './picked-image.svelte'
	import { avatar_hue, initials } from './profile'

	let {
		name,
		seed,
		image,
		fallback,
		uploaded = false,
		error,
		hint,
	}: {
		name: string
		seed: string
		image?: string
		/** What shows once an uploaded `image` is removed, such as the Google photo. */
		fallback?: string
		/** Whether `image` is an upload the person can remove. */
		uploaded?: boolean
		error?: ImageProblem
		/** Replaces the onboarding hint about the Google photo. */
		hint?: string
	} = $props()

	const HINT_ID = 'photo-hint'
	const picked = new PickedImage('avatar')
	let input: HTMLInputElement
	$effect(() => () => picked.clear())

	/** Set when the stored upload is removed; the server clears it on save. */
	let removed = $state(false)
	/** A stored photo that failed to load, so the initials show instead. */
	let broken = $state<string>()

	const stored = $derived(removed ? fallback : image)
	const shown = $derived(picked.url ?? (stored === broken ? undefined : stored))
	const problem = $derived(picked.problem ?? (picked.url ? undefined : error))
	const removable = $derived(!!picked.url || (uploaded && !removed))

	function remove() {
		picked.clear(input)
		if (uploaded) removed = true
	}
</script>

<div class="photo">
	<div class="avwrap" data-morph="avatar">
		<span class="av" style:--h={avatar_hue(seed)} aria-hidden="true">
			{#if shown}
				<!-- Google's photo host can refuse requests that carry a referrer. -->
				<img
					src={shown}
					alt=""
					referrerpolicy="no-referrer"
					onerror={() => {
						if (!picked.url) broken = stored
					}}
				/>
			{:else}
				{initials(name)}
			{/if}
		</span>
		<button
			type="button"
			class="cam"
			aria-label={m.onboarding_photo_change()}
			aria-describedby={HINT_ID}
			onclick={() => input.click()}
		>
			<Icon name="camera" size="sm" />
		</button>
		<input
			bind:this={input}
			type="file"
			name="avatar"
			accept={IMAGE_ACCEPT}
			hidden
			onchange={() => picked.pick(input)}
		/>
		{#if removed}<input type="hidden" name="avatar_remove" value="1" />{/if}
	</div>
	<div>
		<p id={HINT_ID} class:err={problem} aria-live="polite">
			{#if problem}
				{image_problem_text(problem, 'avatar')}
			{:else if hint}
				{hint}
			{:else}
				{m.onboarding_photo_default()}<br />
				{m.onboarding_photo_upload()}
			{/if}
		</p>
		{#if removable}
			<button type="button" class="remove" onclick={remove}>{m.onboarding_photo_remove()}</button>
		{/if}
	</div>
</div>

{#if picked.cropping}
	<ImageCropper
		src={picked.cropping}
		kind="avatar"
		onapply={(blob) => picked.apply(blob)}
		oncancel={() => picked.cancel()}
	/>
{/if}

<style>
	.photo {
		display: flex;
		gap: 16px;
		align-items: center;
		margin-bottom: 24px;
	}
	/* Morphs from the profile header's avatar (see morph.ts), camera included, like the banner. */
	.avwrap {
		position: relative;
		flex: none;
		view-transition-name: profile-avatar;
	}
	.av {
		--size: 96px;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: hsl(var(--h) var(--av-s) var(--av-l));
		color: hsl(var(--h) 45% var(--av-tl));
		font-weight: 700;
		font-size: calc(var(--size) * 0.38);
		letter-spacing: -0.01em;
		user-select: none;
	}
	.av img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Centred on the photo, like the banner's. */
	.cam {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, #000 55%, transparent);
		color: #fff;
	}
	p {
		margin: 0;
		font-size: 14px;
		color: var(--text-2);
	}
	p.err {
		color: var(--danger);
	}
	.remove {
		margin-top: 4px;
		font-size: 13px;
		color: var(--text-2);
	}
	.remove:hover {
		text-decoration: underline;
	}
</style>
