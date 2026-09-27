<script lang="ts">
	import { enhance } from '$app/forms'
	import { resolve } from '$app/paths'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

{#if data.signed_in}
	<form method="post" action="?/signOut" use:enhance>
		<button>Log out</button>
	</form>
{:else}
	<a href={resolve('/login')}>Log in</a>
{/if}
