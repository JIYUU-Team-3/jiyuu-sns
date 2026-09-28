<script lang="ts">
	import { onMount } from 'svelte'
	import { enhance, type SubmitFunction } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import HandleField from '../../../(public)/onboarding/HandleField.svelte'
	import TextField from '../../../(public)/onboarding/TextField.svelte'
	import { BIO_MAX, NAME_MAX, profile_errors } from '../../../(public)/onboarding/profile'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	const FORM_ID = 'edit-profile'

	// Writable deriveds: the saved profile, or a rejected submit, then edited freely.
	let name = $derived(form?.draft.name ?? data.profile.name)
	let handle = $derived(form?.draft.handle ?? data.profile.handle)
	let bio = $derived(form?.draft.bio ?? data.profile.bio)
	let pending = $state(false)
	// Without JavaScript nothing can re-enable the button, so it stays usable until hydration and
	// the server action rejects anything invalid.
	let hydrated = $state(false)
	onMount(() => (hydrated = true))

	const ready = $derived(
		Object.keys(profile_errors({ name: name.trim(), handle: handle.trim(), bio })).length === 0,
	)

	/** Set when the header fails to load, so the plain fill shows instead. */
	let header_broken = $state(false)

	const submit: SubmitFunction = () => {
		pending = true
		return async ({ result, update }) => {
			await update({ reset: false })
			pending = false
			if (result.type === 'redirect') toast.show(m.profile_edit_saved())
		}
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.profile_edit() })}</title></svelte:head>

<PageBar title={m.profile_edit()} back>
	{#snippet action()}
		<button
			type="submit"
			form={FORM_ID}
			class="btn btn-ink sm"
			disabled={hydrated && (!ready || pending)}>{m.profile_edit_save()}</button
		>
	{/snippet}
</PageBar>

<!-- Uploads need an R2 bucket, so both camera buttons stay visible but disabled for now. -->
<div class="media">
	<div class="header">
		{#if data.profile.header && !header_broken}
			<img src={data.profile.header} alt="" onerror={() => (header_broken = true)} />
		{/if}
		<button
			type="button"
			class="cam"
			disabled
			aria-label={m.profile_edit_header_change()}
			title={m.profile_edit_photos_soon()}
		>
			<Icon name="camera" size="sm" />
		</button>
	</div>
	<div class="photo">
		<Avatar
			name={name || data.profile.name}
			seed={data.profile.id}
			image={data.profile.image}
			size={96}
		/>
		<button
			type="button"
			class="cam"
			disabled
			aria-label={m.onboarding_photo_change()}
			title={m.profile_edit_photos_soon()}
		>
			<Icon name="camera" size="sm" />
		</button>
	</div>
</div>

<form id={FORM_ID} class="fields" method="post" use:enhance={submit}>
	<p class="soon">{m.profile_edit_photos_soon()}</p>
	<TextField
		name="name"
		label={m.onboarding_name()}
		max={NAME_MAX}
		counted
		invalid={!!form?.errors.name && !name.trim()}
		autocomplete="name"
		bind:value={name}
	/>
	<HandleField
		bind:value={handle}
		rejected={form?.errors.handle === 'taken' ? form.draft.handle : undefined}
	/>
	<TextField
		name="bio"
		label={m.onboarding_bio()}
		max={BIO_MAX}
		counted
		multiline
		bind:value={bio}
	/>
</form>

<style>
	.header {
		position: relative;
		aspect-ratio: 3 / 1;
		background: var(--img-fallback);
		overflow: hidden;
	}
	.header img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo {
		position: relative;
		width: max-content;
		margin: -48px 0 0 16px;
		border: 4px solid var(--bg);
		border-radius: 50%;
		background: var(--bg);
	}
	.cam {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
	}
	.cam:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.fields {
		padding: 12px 16px 24px;
	}
	.soon {
		margin: 0 0 16px;
		font-size: 13px;
		color: var(--text-2);
	}
</style>
