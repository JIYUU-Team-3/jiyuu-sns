<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms'
	import { m } from '#lib/paraglide/messages.js'
	import GoogleIcon from './GoogleIcon.svelte'

	let { next, failed = false }: { next?: string; failed?: boolean } = $props()
	let pending = $state(false)

	const submit: SubmitFunction = () => {
		pending = true
		return async ({ result, update }) => {
			// A redirect is the trip to Google: stay busy until the page unloads.
			if (result.type !== 'redirect') pending = false
			await update()
		}
	}
</script>

<!-- Coming back from Google via the back button restores this page from bfcache. -->
<svelte:window onpageshow={() => (pending = false)} />

<form method="post" action="?/google" use:enhance={submit}>
	{#if next}<input type="hidden" name="next" value={next} />{/if}
	<button type="submit" class="btn-google" disabled={pending}>
		<GoogleIcon />
		{pending ? m.login_google_pending() : m.login_google()}
	</button>
</form>
{#if failed && !pending}
	<p class="error" role="alert">{m.login_google_error()}</p>
{/if}

<style>
	.btn-google {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 320px;
		max-width: 100%;
		height: 48px;
		padding: 0 24px;
		border: 1px solid var(--line-2);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 16px;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s,
			opacity 0.15s;
	}
	.btn-google:hover {
		background: var(--bg-2);
	}
	.btn-google:disabled {
		cursor: default;
	}
	.error {
		font-size: 13px;
		color: var(--danger);
		margin: 14px 0 0;
	}
	@media (max-width: 700px) {
		.btn-google {
			width: 100%;
		}
	}
</style>
