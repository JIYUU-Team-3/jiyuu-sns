<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import SiteFooter from '../SiteFooter.svelte'
	import Wordmark from '../Wordmark.svelte'
	import { localized } from '../links'
</script>

<svelte:head><title>{m.session_ended_page_title()}</title></svelte:head>

<div class="ended">
	<main>
		<Wordmark size="40px" />
		<h1>{m.session_ended_title()}</h1>
		<a class="btn-login" href={localized('/login')}>{m.session_ended_log_in()}</a>
	</main>
	<SiteFooter fixed />
</div>

<style>
	.ended {
		min-height: 100vh;
		padding-top: env(safe-area-inset-top);
		display: grid;
	}
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px 96px;
		text-align: center;
	}
	h1 {
		font-size: 23px;
		font-weight: 800;
		letter-spacing: -0.01em;
		margin: 32px 0 20px;
	}
	h1:lang(km) {
		line-height: 1.4;
		letter-spacing: normal;
	}
	/* The login page's Google button, without the Google. */
	.btn-login {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 320px;
		max-width: 100%;
		height: 48px;
		padding: 0 24px;
		border: 1px solid var(--line-2);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
		white-space: nowrap;
		transition: background-color 0.15s;
	}
	.btn-login:hover {
		background: var(--bg-2);
	}
</style>
