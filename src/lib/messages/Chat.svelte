<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { onMount, tick, untrack } from 'svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { format_month_year } from '#lib/format-date'
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import { current_time } from '#lib/posts/state.svelte'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import Menu from '#lib/ui/Menu.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { messages_arg } from './args'
	import ConversationAvatar from './ConversationAvatar.svelte'
	import { format_day } from './format'
	import { messages_href } from './links'
	import { connect_live, type LiveEvent } from './live'
	import MessageComposer from './MessageComposer.svelte'
	import MessageItem from './MessageItem.svelte'
	import {
		get_conversation,
		get_messages,
		leave_conversation,
		live_ticket,
		mark_conversation_read,
		react_to_message,
		send_message,
	} from './messages.remote'
	import {
		conversation_title,
		is_reaction,
		receipt_status,
		same_day,
		toggle_reaction,
	} from './rules'
	import type { MessageView, OutgoingMessage, Reaction } from './types'

	let { id }: { id: string } = $props()

	const RUN_GAP = 5 * 60_000

	const convo = $derived(await get_conversation(id))
	const latest = $derived(await get_messages(messages_arg(id)))

	let older = $state<MessageView[]>([])
	let older_next = $state<string>()
	let loaded_older = $state(false)
	let loading_older = $state(false)
	let pending = $state<MessageView[]>([])
	let replying = $state<MessageView>()
	let leaving = $state(false)
	let scroller = $state<HTMLDivElement>()
	let log = $state<HTMLDivElement>()
	let stick = true
	let last_marked: string | undefined
	let looking = $state(false)
	const reactions = new SvelteMap<string, Reaction[]>()

	const title = $derived(conversation_title(convo, m.dm_deleted_account()))
	const other = $derived(!convo.group ? convo.members[0] : undefined)
	const next = $derived(loaded_older ? older_next : latest.next)
	const other_meta = $derived(
		other?.handle
			? [
					`@${other.handle}`,
					other.joined && m.profile_joined({ date: format_month_year(other.joined, getLocale()) }),
				]
					.filter(Boolean)
					.join(' · ')
			: '',
	)

	const items = $derived.by(() => {
		const fresh = new Set(latest.items.map((message) => message.id))
		return [...older.filter((message) => !fresh.has(message.id)), ...[...latest.items].reverse()]
	})
	const rows = $derived([
		...items.map((message) => ({ message, pending: false })),
		...pending.map((message) => ({ message, pending: true })),
	])

	const receipt = $derived.by(() => {
		const newest = rows.at(-1)
		if (!newest || newest.pending || !newest.message.mine) return undefined
		const { status, seen_by } = receipt_status(newest.message.created_at, latest.receipts)
		if (status === 'sent') return m.dm_sent()
		if (status === 'delivered') return m.dm_delivered()
		if (!convo.group) return m.dm_seen()
		if (seen_by.length === latest.receipts.length) return m.dm_seen_by_all()
		const names = convo.members
			.filter((member) => seen_by.includes(member.id))
			.map((member) => member.name)
		return m.dm_seen_by({ names: names.join(', ') })
	})

	const joined = (a: MessageView | undefined, b: MessageView | undefined) =>
		!!a &&
		!!b &&
		a.sender.id === b.sender.id &&
		b.created_at - a.created_at < RUN_GAP &&
		same_day(a.created_at, b.created_at)

	const TYPING_SHOWN = 6_000
	const TYPING_REPEAT = 2_500
	const LIVE_POLL = 30_000

	const typing = new SvelteMap<string, ReturnType<typeof setTimeout>>()
	let live: ReturnType<typeof connect_live> | undefined
	let typing_sent = 0
	let last_poll = 0

	const typers = $derived(convo.members.filter((member) => typing.has(member.id)))
	const typing_label = $derived(
		typers.length === 1
			? m.dm_typing({ name: typers[0].name })
			: m.dm_typing_many({ count: typers.length }),
	)

	function stop_typing(user_id: string) {
		clearTimeout(typing.get(user_id))
		typing.delete(user_id)
	}

	function onlive(event: LiveEvent) {
		if (event.type === 'refresh') {
			last_poll = Date.now()
			get_messages(messages_arg(id))
				.refresh()
				.catch(() => {})
			return
		}
		stop_typing(event.user_id)
		if (event.on)
			typing.set(
				event.user_id,
				setTimeout(() => typing.delete(event.user_id), TYPING_SHOWN),
			)
	}

	function ontyping(active: boolean) {
		const now = Date.now()
		if (active && now - typing_sent >= TYPING_REPEAT) {
			typing_sent = now
			live?.send('typing')
		} else if (!active && typing_sent) {
			typing_sent = 0
			live?.send('idle')
		}
	}

	$effect(() => {
		const room = id
		const connection = untrack(() => connect_live(room, () => live_ticket(room), onlive))
		live = connection
		return () => {
			connection.close()
			for (const user_id of [...typing.keys()]) untrack(() => stop_typing(user_id))
			typing_sent = 0
		}
	})

	function sync_looking() {
		looking = document.visibilityState === 'visible' && document.hasFocus()
	}

	onMount(() => {
		sync_looking()
		const timer = setInterval(() => {
			if (document.visibilityState !== 'visible') return
			if (live?.open && Date.now() - last_poll < LIVE_POLL) return
			last_poll = Date.now()
			get_messages(messages_arg(id))
				.refresh()
				.catch(() => {})
		}, 4_000)
		return () => clearInterval(timer)
	})

	$effect(() => {
		const current = latest.items
		untrack(() => {
			if (!loaded_older) return
			const known = new Set(older.map((message) => message.id))
			const added = current.filter((message) => !known.has(message.id)).reverse()
			if (added.length) older = [...older, ...added]
		})
	})

	$effect(() => {
		const newest = latest.items[0]
		if (!looking || !newest || newest.mine || newest.id === last_marked) return
		last_marked = newest.id
		mark_conversation_read(id).catch(() => {})
	})

	$effect(() => {
		if (!scroller || !log) return
		const box = scroller
		const observer = new ResizeObserver(() => {
			if (stick) box.scrollTop = box.scrollHeight
		})
		observer.observe(log)
		observer.observe(box)
		return () => observer.disconnect()
	})

	function onscroll() {
		if (scroller) stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120
	}

	async function load_older() {
		if (!next || loading_older || !scroller) return
		loading_older = true
		const from_bottom = scroller.scrollHeight - scroller.scrollTop
		try {
			const result = await get_messages(messages_arg(id, next))
			const base = loaded_older ? older : [...latest.items].reverse()
			older = [...[...result.items].reverse(), ...base]
			older_next = result.next
			loaded_older = true
			await tick()
			scroller.scrollTop = scroller.scrollHeight - from_bottom
		} catch {
			toast.show(m.toast_error())
		} finally {
			loading_older = false
		}
	}

	async function send(outgoing: OutgoingMessage) {
		const me = page.data.me
		const reply = replying
		const temp: MessageView = {
			id: crypto.randomUUID(),
			sender: me,
			mine: true,
			body: outgoing.body,
			blocked_hosts: [],
			media: outgoing.media,
			reply_to: reply && {
				id: reply.id,
				sender_name: reply.sender.name,
				mine: reply.mine,
				body: reply.body,
				media_kind: reply.media?.kind,
			},
			reactions: [],
			created_at: Date.now(),
		}
		stick = true
		if (scroller) scroller.scrollTop = scroller.scrollHeight
		pending = [...pending, temp]
		replying = undefined
		try {
			await send_message({ id, ...outgoing, reply_to: reply?.id })
			return true
		} catch (cause) {
			toast.show(refusal_message(cause, m.dm_send_failed))
			replying = reply
			return false
		} finally {
			pending = pending.filter((message) => message.id !== temp.id)
		}
	}

	const react_seq: Record<string, number> = {}

	async function react(message: MessageView, emoji: string) {
		if (!is_reaction(emoji)) return
		const before = reactions.get(message.id) ?? message.reactions
		reactions.set(message.id, toggle_reaction(before, emoji))
		const seq = (react_seq[message.id] ?? 0) + 1
		react_seq[message.id] = seq
		try {
			const result = await react_to_message({ id: message.id, emoji })
			if (react_seq[message.id] !== seq) return
			if (latest.items.some((item) => item.id === message.id)) reactions.delete(message.id)
			else reactions.set(message.id, result)
		} catch {
			if (react_seq[message.id] !== seq) return
			reactions.set(message.id, before)
			toast.show(m.toast_error())
		}
	}

	function jump(target: string) {
		const element = document.getElementById(`msg-${target}`)
		if (!element) return
		element.scrollIntoView({ block: 'center', behavior: 'smooth' })
		element.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 600 })
	}

	async function leave() {
		leaving = false
		try {
			await leave_conversation(id)
			await goto(messages_href())
		} catch {
			toast.show(m.toast_error())
		}
	}
</script>

<svelte:window onfocus={sync_looking} onblur={sync_looking} />
<svelte:document onvisibilitychange={sync_looking} />

<svelte:head><title>{m.site_page_title({ page: title })}</title></svelte:head>

<header class="bar">
	<a class="icon-btn back" href={messages_href()} aria-label={m.app_back()}>
		<Icon name="back" />
	</a>
	<div class="titles">
		<h1>{title}</h1>
		<p class="sub">
			{other?.handle ? `@${other.handle}` : m.dm_members_count({ count: convo.members.length + 1 })}
		</p>
	</div>
	{#if other?.handle || convo.group}
		<Menu label={m.dm_options()}>
			{#snippet trigger(props)}
				<button type="button" class="icon-btn" aria-label={m.dm_options()} {...props}>
					<Icon name="more" />
				</button>
			{/snippet}
			{#snippet children(close)}
				{#if other?.handle}
					<a class="menu-item" role="menuitem" href={profile_href(other.handle)} onclick={close}>
						<Icon name="user" />{m.dm_view_profile()}
					</a>
				{/if}
				{#if convo.group}
					<button
						type="button"
						class="menu-item danger"
						role="menuitem"
						onclick={() => {
							close()
							leaving = true
						}}
					>
						<Icon name="logout" />{m.dm_leave()}
					</button>
				{/if}
			{/snippet}
		</Menu>
	{/if}
</header>

<div class="chat" bind:this={scroller} {onscroll}>
	<div class="log" bind:this={log}>
		{#if next}
			<button type="button" class="older" disabled={loading_older} onclick={load_older}
				>{loading_older ? m.composer_picker_loading() : m.dm_load_older()}</button
			>
		{:else}
			<div class="intro">
				{#if other?.handle}
					<a href={profile_href(other.handle)} class="intro-av" tabindex="-1" aria-hidden="true">
						<ConversationAvatar {convo} large />
					</a>
					<b>{other.name}</b>
					<span>{other_meta}</span>
				{:else}
					<span class="intro-av"><ConversationAvatar {convo} large /></span>
					<b>{title}</b>
					{#if convo.group}
						<span
							>{m.dm_group_intro({
								names: convo.members.map((member) => member.name).join(', '),
							})}</span
						>
					{/if}
				{/if}
			</div>
		{/if}

		{#each rows as row, i (row.message.id)}
			{@const previous = rows[i - 1]?.message}
			{@const following = rows[i + 1]?.message}
			{#if !previous || !same_day(previous.created_at, row.message.created_at)}
				<div class="day">{format_day(row.message.created_at, current_time(), getLocale())}</div>
			{/if}
			<MessageItem
				message={row.message}
				reactions={reactions.get(row.message.id) ?? row.message.reactions}
				group={convo.group}
				first={!joined(previous, row.message)}
				last={!joined(row.message, following)}
				pending={row.pending}
				receipt={i === rows.length - 1 ? receipt : undefined}
				onreply={() => (replying = row.message)}
				onreact={(emoji) => react(row.message, emoji)}
				onjump={jump}
			/>
		{/each}
		{#if typers.length}
			<div class="typing" role="status">
				<span class="typers" aria-hidden="true">
					{#each typers.slice(0, 3) as typer (typer.id)}
						<Avatar name={typer.name} seed={typer.id} image={typer.image} size={32} />
					{/each}
				</span>
				<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
				<span class:sr={!convo.group}>{typing_label}</span>
			</div>
		{/if}
	</div>
</div>

<MessageComposer {replying} oncancelreply={() => (replying = undefined)} onsend={send} {ontyping} />

{#if leaving}
	<ConfirmDialog
		title={m.dm_leave_title()}
		body={m.dm_leave_body()}
		cta={m.dm_leave_cta()}
		onconfirm={leave}
		oncancel={() => (leaving = false)}
	/>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 53px;
		padding: env(safe-area-inset-top) 12px 0;
		border-bottom: 1px solid var(--line);
		/* Sits above the scrolling log, so it can fade with the page in transparent mode. */
		background: var(--page-bg);
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 800;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		margin: 0;
		color: var(--text-2);
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chat {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.log {
		padding: 16px 16px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.older {
		align-self: center;
		margin-bottom: 12px;
		padding: 6px 14px;
		border-radius: 999px;
		color: var(--accent-text);
		font-weight: 600;
	}
	.older:hover {
		background: var(--accent-soft);
	}
	.intro {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 2px;
		padding: 20px 0 28px;
		margin-bottom: 8px;
		border-bottom: 1px solid var(--line);
	}
	.intro-av {
		display: flex;
		margin-bottom: 8px;
	}
	.intro b {
		font-size: 17px;
		overflow-wrap: anywhere;
	}
	.intro span {
		color: var(--text-2);
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	.typing {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
		color: var(--text-2);
		font-size: 13px;
		animation: rise 0.2s var(--ease-out);
	}
	.typers {
		display: flex;
		flex: none;
	}
	.typers :global(.av + .av) {
		margin-left: -10px;
		box-shadow: 0 0 0 2px var(--bg);
	}
	.dots {
		display: flex;
		gap: 4px;
		padding: 13px 14px;
		border-radius: 20px;
		background: var(--bg-3);
	}
	.dots i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-2);
		animation: bounce 1.2s infinite ease-in-out;
	}
	.dots i:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dots i:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}
		30% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.typing,
		.dots i {
			animation: none;
		}
	}
	.day {
		align-self: center;
		color: var(--text-2);
		font-size: 13px;
		margin: 14px 0 6px;
	}
	@media (min-width: 1011px) {
		.back {
			display: none;
		}
	}
</style>
