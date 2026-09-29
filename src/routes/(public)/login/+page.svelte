<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import type { PageProps } from './$types'
	import Mark from '../Mark.svelte'
	import RichText from '../RichText.svelte'
	import SiteFooter from '../SiteFooter.svelte'
	import Wordmark from '../Wordmark.svelte'
	import { localized } from '../links'
	import GoogleSignIn from './GoogleSignIn.svelte'

	let { form }: PageProps = $props()
</script>

<svelte:head><title>{m.login_page_title()}</title></svelte:head>

<div class="auth">
	<div class="auth-art" aria-hidden="true"><Mark size="min(300px, 40vw)" /></div>
	<main class="auth-main">
		<div class="auth-top-mobile"><Mark size="40px" /></div>
		<h1>{m.login_title()}</h1>
		<h2>
			{#each m.login_join.parts() as part, i (i)}
				{#if part.type === 'text'}{part.value}{:else if part.name === 'wordmark'}<Wordmark />{/if}
			{/each}
		</h2>
		<GoogleSignIn failed={form?.google_failed} />
		<p class="auth-legal">
			<RichText
				parts={m.login_legal.parts()}
				hrefs={{ terms: localized('/terms'), privacy: localized('/privacy') }}
			/>
		</p>
	</main>
	<SiteFooter fixed />
</div>

<style>
	.auth {
		min-height: 100vh;
		padding-top: env(safe-area-inset-top);
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.auth-art {
		display: grid;
		place-items: center;
		padding: 48px;
		border-right: 1px solid var(--line);
		background: var(--bg-2);
	}
	.auth-main {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 48px 64px;
		max-width: 620px;
	}
	.auth-main h1 {
		font-size: 56px;
		line-height: 1.05;
		letter-spacing: -0.035em;
		margin: 0 0 28px;
		font-weight: 800;
	}
	.auth-main h2 {
		font-size: 23px;
		margin: 0 0 20px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.auth-main h1:lang(km),
	.auth-main h2:lang(km) {
		line-height: 1.4;
		letter-spacing: normal;
	}
	.auth-legal {
		font-size: 13px;
		color: var(--text-2);
		max-width: 320px;
		margin: 14px 0 0;
	}
	.auth-legal :global(a) {
		color: var(--accent-text);
	}
	.auth-top-mobile {
		display: none;
	}

	@media (max-width: 700px) {
		.auth {
			grid-template-columns: 1fr;
		}
		.auth-art {
			display: none;
		}
		.auth-top-mobile {
			display: flex;
			padding: 24px 24px 0;
		}
		.auth-main {
			padding: 40px 24px 96px;
			justify-content: flex-start;
		}
		.auth-main h1 {
			font-size: 40px;
			margin-top: 12vh;
		}
		.auth-legal {
			max-width: none;
		}
	}
</style>
