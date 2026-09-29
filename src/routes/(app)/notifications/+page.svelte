<script lang="ts">
	import { onMount } from 'svelte'
	import { notifications_arg } from '#lib/notifications/args'
	import NotificationList from '#lib/notifications/NotificationList.svelte'
	import {
		get_notifications,
		mark_notifications_read,
	} from '#lib/notifications/notifications.remote'
	import PushToggle from '#lib/notifications/PushToggle.svelte'
	import type { NotificationTab } from '#lib/notifications/types'
	import { m } from '#lib/paraglide/messages.js'
	import EmptyState from '#lib/ui/EmptyState.svelte'
	import Tabs from '#lib/ui/Tabs.svelte'
	import PageBar from '../PageBar.svelte'

	let tab = $state<NotificationTab>('all')

	const TABS: [NotificationTab, () => string][] = [
		['all', m.notifications_all],
		['mentions', m.notifications_mentions],
	]

	// The rows came back marked unread, so they keep their highlight while the badge clears.
	onMount(() => {
		mark_notifications_read().catch(() => {})
	})
</script>

<svelte:head><title>{m.site_page_title({ page: m.app_notifications() })}</title></svelte:head>

<PageBar title={m.app_notifications()}>
	<Tabs tabs={TABS} bind:value={tab} />
</PageBar>

<PushToggle />

{#key tab}
	<div role="tabpanel">
		<NotificationList load={(cursor) => get_notifications(notifications_arg(tab, cursor))}>
			{#snippet empty()}
				{#if tab === 'mentions'}
					<EmptyState
						title={m.notifications_mentions_empty_title()}
						body={m.notifications_mentions_empty_body()}
					/>
				{:else}
					<EmptyState title={m.notifications_empty_title()} body={m.notifications_empty_body()} />
				{/if}
			{/snippet}
		</NotificationList>
	</div>
{/key}
