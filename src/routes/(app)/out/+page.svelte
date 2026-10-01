<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { post_href } from '#lib/posts/links'
	import PageBar from '../PageBar.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<svelte:head><title>{m.site_page_title({ page: m.out_title() })}</title></svelte:head>

<PageBar title={m.out_title()} back />

<div class="page">
	<p>{m.out_body()}</p>
	<p class="host">{data.host}</p>
	<p class="href">{data.href}</p>
	<div class="row">
		<!-- The address came from a post the reader can see, picked by index, never from the URL. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a class="btn btn-primary" href={data.href} rel="noopener noreferrer nofollow ugc"
			>{m.out_continue()}</a
		>
		<a class="btn btn-outline" href={post_href(data.post_id)}>{m.out_back()}</a>
	</div>
</div>

<style>
	.page {
		padding: 16px;
	}
	.host {
		font-size: 22px;
		font-weight: 800;
		margin: 16px 0 4px;
		overflow-wrap: anywhere;
	}
	.href {
		color: var(--text-2);
		overflow-wrap: anywhere;
		margin: 0 0 20px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
