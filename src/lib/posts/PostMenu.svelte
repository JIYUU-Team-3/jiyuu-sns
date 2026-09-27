<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { post_url } from './links'
	import { delete_post } from './posts.remote'
	import { composer, deleted_posts } from './state.svelte'
	import type { PostView } from './types'

	let {
		post,
		class: klass = '',
		ondeleted,
	}: {
		post: PostView
		class?: string
		/** After the server confirms, e.g. to leave the deleted post's own page. */
		ondeleted?: () => void
	} = $props()

	let confirming = $state(false)

	async function copy_link() {
		try {
			await navigator.clipboard.writeText(post_url(post.id))
			toast.show(m.toast_link_copied())
		} catch {
			toast.show(m.toast_error())
		}
	}

	async function remove() {
		confirming = false
		// Gone everywhere at once; back again if the server refuses.
		deleted_posts.add(post.id)
		try {
			await delete_post(post.id)
			toast.show(m.toast_deleted())
			ondeleted?.()
		} catch {
			deleted_posts.delete(post.id)
			toast.show(m.toast_error())
		}
	}
</script>

<Menu label={m.post_more()} class={klass}>
	{#snippet trigger(props)}
		<button type="button" class="icon-btn more" aria-label={m.post_more()} {...props}>
			<Icon name="more" size="sm" />
		</button>
	{/snippet}
	{#snippet children(close)}
		{#if post.mine}
			<button
				type="button"
				class="menu-item"
				role="menuitem"
				onclick={() => {
					close()
					composer.open({ kind: 'edit', post })
				}}
			>
				<Icon name="pencil" />{m.post_edit()}
			</button>
		{/if}
		<button
			type="button"
			class="menu-item"
			role="menuitem"
			onclick={() => {
				close()
				copy_link()
			}}
		>
			<Icon name="link" />{m.post_copy_link()}
		</button>
		{#if post.mine}
			<div class="menu-sep" role="separator"></div>
			<button
				type="button"
				class="menu-item danger"
				role="menuitem"
				onclick={() => {
					close()
					confirming = true
				}}
			>
				<Icon name="trash" />{m.post_delete()}
			</button>
		{/if}
	{/snippet}
</Menu>

{#if confirming}
	<ConfirmDialog
		title={m.post_delete_title()}
		body={m.post_delete_body()}
		cta={m.post_delete_cta()}
		onconfirm={remove}
		oncancel={() => (confirming = false)}
	/>
{/if}

<style>
	.more {
		color: var(--text-2);
	}
	.more:hover,
	.more[aria-expanded='true'] {
		color: var(--accent-text);
		background: var(--accent-soft);
	}
</style>
