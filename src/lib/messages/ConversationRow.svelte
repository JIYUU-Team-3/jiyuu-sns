<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { current_time } from '#lib/posts/state.svelte'
	import ConversationAvatar from './ConversationAvatar.svelte'
	import { format_list_time } from './format'
	import { conversation_href } from './links'
	import { conversation_title } from './rules'
	import type { ConversationView } from './types'

	let { convo, active = false }: { convo: ConversationView; active?: boolean } = $props()

	const title = $derived(conversation_title(convo, m.dm_deleted_account()))
	const handle = $derived(!convo.group ? convo.members[0]?.handle : undefined)

	const preview = $derived.by(() => {
		const last = convo.last
		if (!last) return m.dm_no_messages()
		const text = last.body || (last.media_kind === 'gif' ? m.dm_sent_gif() : m.dm_sent_photo())
		if (last.mine) return m.dm_you_prefix({ text })
		if (convo.group) return m.dm_sender_prefix({ name: last.sender_name.split(/\s+/)[0], text })
		return text
	})
</script>

<a
	class="row"
	class:unread={convo.unread}
	href={conversation_href(convo.id)}
	aria-current={active ? 'page' : undefined}
>
	<ConversationAvatar {convo} />
	<div class="info">
		<div class="top">
			<b>{title}</b>
			{#if handle}
				<span>@{handle}</span>
			{:else if convo.group}
				<span>{m.dm_people_count({ count: convo.members.length + 1 })}</span>
			{/if}
			{#if convo.last}
				<span class="time"
					>· {format_list_time(convo.last.created_at, current_time(), getLocale())}</span
				>
			{/if}
		</div>
		<div class="prev">{preview}</div>
	</div>
	{#if convo.unread}
		<span class="dot" aria-hidden="true"></span>
		<span class="sr">{m.dm_unread()}</span>
	{/if}
</a>

<style>
	.row {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		align-items: flex-start;
		transition: background-color 0.15s;
	}
	.row:hover,
	.row[aria-current='page'] {
		background: var(--bg-2);
	}
	.row[aria-current='page'] {
		box-shadow: inset -2px 0 0 var(--accent);
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.top {
		display: flex;
		gap: 4px;
		align-items: baseline;
		min-width: 0;
	}
	.top b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.top span {
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.top .time {
		flex: none;
	}
	.prev {
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 1px;
	}
	.unread .prev {
		color: var(--text);
		font-weight: 600;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		margin-top: 8px;
		flex: none;
	}
</style>
