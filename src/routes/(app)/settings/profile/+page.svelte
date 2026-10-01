<script lang="ts">
	import { onMount } from 'svelte'
	import { enhance, type SubmitFunction } from '$app/forms'
	import { afterNavigate } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import BannerField from '#lib/profiles/form/BannerField.svelte'
	import HandleField from '#lib/profiles/form/HandleField.svelte'
	import ProfilePhoto from '#lib/profiles/form/ProfilePhoto.svelte'
	import TextField from '#lib/profiles/form/TextField.svelte'
	import { leave_after_save } from '#lib/profiles/form/after-save'
	import { BIO_MAX, NAME_MAX, profile_errors } from '#lib/profiles/form/profile'
	import { profile_href } from '#lib/profiles/links'
	import PageBar from '../../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	// Writable deriveds: prefilled from the saved profile, or from a rejected submit.
	let name = $derived(form?.draft.name ?? data.draft.name)
	let handle = $derived(form?.draft.handle ?? data.draft.handle)
	let bio = $derived(form?.draft.bio ?? data.draft.bio)
	let pending = $state(false)
	// Without JavaScript nothing can re-enable the button, so it stays usable until hydration.
	let hydrated = $state(false)
	onMount(() => (hydrated = true))

	const ready = $derived(
		Object.keys(profile_errors({ name: name.trim(), handle: handle.trim(), bio })).length === 0,
	)

	// Null on a direct load, so saving then just replaces this page.
	let from_path: string | undefined
	afterNavigate(({ from }) => (from_path = from?.url.pathname))

	const from_own_profile = () =>
		from_path === new URL(profile_href(data.me.handle), location.href).pathname

	const submit: SubmitFunction = () => {
		pending = true
		return async ({ result, update }) => {
			// Handled here, not by update(), which would push the profile on top of this page.
			if (result.type === 'redirect') leave_after_save(result.location, from_own_profile())
			else await update({ reset: false })
			pending = false
		}
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.profile_edit() })}</title></svelte:head>

<PageBar title={m.profile_edit()} back />

<form class="edit" method="post" enctype="multipart/form-data" use:enhance={submit}>
	<BannerField image={data.own.banner} error={form?.errors.banner} />
	<ProfilePhoto
		{name}
		seed={data.me.id}
		image={data.me.image}
		fallback={data.own.account_image}
		uploaded={data.own.avatar_uploaded}
		error={form?.errors.avatar}
		hint={m.profile_edit_photo_hint()}
	/>

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
		taken={form?.errors.handle === 'taken' ? form.draft.handle : undefined}
	/>
	<TextField
		name="bio"
		label={m.onboarding_bio()}
		placeholder={m.onboarding_bio_placeholder()}
		max={BIO_MAX}
		multiline
		bind:value={bio}
	/>

	<button class="btn btn-primary save" disabled={hydrated && (!ready || pending)}
		>{m.profile_edit_save()}</button
	>
</form>

<style>
	.edit {
		padding: 16px;
	}
	.save {
		width: 100%;
	}
</style>
