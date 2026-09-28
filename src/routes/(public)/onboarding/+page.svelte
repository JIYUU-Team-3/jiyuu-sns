<script lang="ts">
	import { onMount } from 'svelte'
	import { enhance, type SubmitFunction } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import type { PageProps } from './$types'
	import Mark from '../Mark.svelte'
	import GoogleIcon from '../login/GoogleIcon.svelte'
	import HandleField from './HandleField.svelte'
	import ProfilePhoto from './ProfilePhoto.svelte'
	import TextField from './TextField.svelte'
	import { BIO_MAX, NAME_MAX, profile_errors } from './profile'

	let { data, form }: PageProps = $props()

	// Writable deriveds: prefilled from Google, or from a rejected submit, then edited freely.
	let name = $derived(form?.draft.name ?? data.account.name.slice(0, NAME_MAX))
	let handle = $derived(form?.draft.handle ?? data.suggested_handle)
	let bio = $derived(form?.draft.bio ?? '')
	let pending = $state(false)
	// Without JavaScript nothing can re-enable the button, so it stays usable until hydration and
	// the server action rejects anything invalid.
	let hydrated = $state(false)
	onMount(() => (hydrated = true))

	const ready = $derived(
		Object.keys(profile_errors({ name: name.trim(), handle: handle.trim(), bio })).length === 0,
	)

	const submit: SubmitFunction = () => {
		pending = true
		return async ({ update }) => {
			await update({ reset: false })
			pending = false
		}
	}
</script>

<svelte:head><title>{m.site_page_title({ page: m.onboarding_title() })}</title></svelte:head>

<main class="onb">
	<form class="card" method="post" use:enhance={submit}>
		<div class="top"><Mark size="36px" /></div>
		<h1>{m.onboarding_title()}</h1>
		<p class="sub">{m.onboarding_subtitle()}</p>

		<div class="google">
			<GoogleIcon />
			<span>
				{#each m.onboarding_signed_in_as.parts() as part, i (i)}
					{#if part.type === 'text'}{part.value}{:else if part.name === 'email'}<b
							>{data.account.email}</b
						>{/if}
				{/each}
			</span>
		</div>

		<ProfilePhoto {name} seed={data.account.email} image={data.account.image} />

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
			placeholder={m.onboarding_bio_placeholder()}
			max={BIO_MAX}
			multiline
			bind:value={bio}
		/>

		<button class="continue" disabled={hydrated && (!ready || pending)}
			>{m.onboarding_continue()}</button
		>
	</form>
</main>

<style>
	.onb {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		align-items: start;
		padding: 6vh 16px;
		background: var(--bg-2);
	}
	.card {
		width: 480px;
		max-width: 100%;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 24px 32px 28px;
	}
	.top {
		display: flex;
		justify-content: center;
		margin-bottom: 16px;
	}
	h1 {
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 4px;
	}
	/* Khmer stacks vowels and subscripts above and below the line, and tight tracking breaks clusters. */
	h1:lang(km) {
		line-height: 1.4;
		letter-spacing: normal;
	}
	.sub {
		color: var(--text-2);
		margin: 0 0 24px;
	}
	.google {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 14px;
		color: var(--text-2);
		background: var(--bg-2);
		border-radius: 10px;
		padding: 10px 12px;
		margin-bottom: 20px;
	}
	.google :global(svg) {
		width: 16px;
		height: 16px;
		flex: none;
	}
	.google span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.google b {
		color: var(--text);
	}
	.continue {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 48px;
		padding: 0 24px;
		border: 0;
		border-radius: 999px;
		background: var(--accent-fill);
		color: var(--on-accent);
		font: inherit;
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 0.15s,
			opacity 0.15s;
	}
	.continue:hover {
		background: var(--accent-fill-hover);
	}
	.continue:disabled {
		opacity: 0.45;
		cursor: default;
		background: var(--accent-fill);
	}
	@media (max-width: 700px) {
		.card {
			padding: 20px 20px 24px;
		}
	}
</style>
