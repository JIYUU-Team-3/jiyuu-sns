<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { block, mute } from '#lib/safety/actions'
	import ReportDialog from '#lib/safety/ReportDialog.svelte'
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
	let blocking = $state(false)
	let reporting = $state(false)

	const handle = $derived(post.mine ? undefined : post.author.handle)

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
		{#if handle}
			<div class="menu-sep" role="separator"></div>
			<button
				type="button"
				class="menu-item"
				role="menuitem"
				onclick={() => {
					close()
					mute({ id: post.author.id, handle }, true)
				}}
			>
				<Icon name="volume-x" />{m.safety_mute({ handle })}
			</button>
			<button
				type="button"
				class="menu-item"
				role="menuitem"
				onclick={() => {
					close()
					blocking = true
				}}
			>
				<Icon name="ban" />{m.safety_block({ handle })}
			</button>
			<button
				type="button"
				class="menu-item danger"
				role="menuitem"
				onclick={() => {
					close()
					reporting = true
				}}
			>
				<Icon name="flag" />{m.safety_report_post()}
			</button>
		{/if}
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

{#if blocking && handle}
	<ConfirmDialog
		title={m.safety_block_title({ handle })}
		body={m.safety_block_body()}
		cta={m.safety_block_cta()}
		onconfirm={() => {
			blocking = false
			block({ id: post.author.id, handle }, true)
		}}
		oncancel={() => (blocking = false)}
	/>
{/if}

{#if reporting && handle}
	<ReportDialog {handle} post_id={post.id} onclose={() => (reporting = false)} />
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
