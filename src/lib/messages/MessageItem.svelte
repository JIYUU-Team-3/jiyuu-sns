<script lang="ts">
	import { m } from '#lib/paraglide/messages.js'
	import { getLocale } from '#lib/paraglide/runtime'
	import PostText from '#lib/posts/PostText.svelte'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { format_clock } from './format'
	import { REACTIONS } from './rules'
	import type { MessageView, Reaction } from './types'

	let {
		message,
		reactions,
		group,
		first,
		last,
		pending = false,
		onreply,
		onreact,
		onjump,
	}: {
		message: MessageView
		reactions: Reaction[]
		group: boolean
		first: boolean
		last: boolean
		pending?: boolean
		onreply: () => void
		onreact: (emoji: string) => void
		onjump: (id: string) => void
	} = $props()

	let picking = $state(false)
	let wrap = $state<HTMLDivElement>()

	const ref = $derived(message.reply_to)
	const ref_text = $derived(
		ref ? ref.body || (ref.media_kind === 'gif' ? m.dm_gif() : m.dm_photo()) : '',
	)

	$effect(() => {
		if (!picking) return
		const outside = (event: PointerEvent) => {
			if (!wrap?.contains(event.target as Node)) picking = false
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') picking = false
		}
		window.addEventListener('pointerdown', outside, true)
		window.addEventListener('keydown', escape)
		return () => {
			window.removeEventListener('pointerdown', outside, true)
			window.removeEventListener('keydown', escape)
		}
	})
</script>

<div class="msg" class:mine={message.mine} class:pending class:first id="msg-{message.id}">
	{#if !message.mine}
		{#if last && message.sender.handle}
			<a class="av" href={profile_href(message.sender.handle)} tabindex="-1" aria-hidden="true">
				<Avatar
					name={message.sender.name}
					seed={message.sender.id}
					image={message.sender.image}
					size={32}
				/>
			</a>
		{:else if last}
			<span class="av">
				<Avatar
					name={message.sender.name}
					seed={message.sender.id}
					image={message.sender.image}
					size={32}
				/>
			</span>
		{:else}
			<span class="av ghost"></span>
		{/if}
	{/if}
	<div class="col">
		{#if group && !message.mine && first}
			<div class="sender">{message.sender.name}</div>
		{/if}
		{#if ref}
			<button type="button" class="ref" onclick={() => onjump(ref.id)}>
				<span class="ref-label">
					<Icon name="corner-reply" size="xs" />
					{m.dm_replying_to({ name: ref.mine ? m.dm_you() : ref.sender_name })}
				</span>
				<span class="ref-body">{ref_text}</span>
			</button>
		{/if}
		{#if message.media}
			<div class="media" style:aspect-ratio="{message.media.width} / {message.media.height}">
				<img
					src={message.media.url}
					alt={message.media.kind === 'gif' ? m.post_gif_label() : m.dm_photo()}
					width={message.media.width}
					height={message.media.height}
					loading="lazy"
				/>
				{#if message.media.kind === 'gif'}<span class="badge" aria-hidden="true">GIF</span>{/if}
			</div>
		{/if}
		{#if message.body}
			<div class="bubble"><PostText body={message.body} blocked={message.blocked_hosts} /></div>
		{/if}
		{#if reactions.length}
			<div class="reacts">
				{#each reactions as reaction (reaction.emoji)}
					<button
						type="button"
						class="chip"
						class:me={reaction.mine}
						aria-pressed={reaction.mine}
						aria-label={m.dm_reaction_label({ emoji: reaction.emoji, count: reaction.count })}
						onclick={() => onreact(reaction.emoji)}
						>{reaction.emoji} <span class="num">{reaction.count}</span></button
					>
				{/each}
			</div>
		{/if}
		{#if last}
			<div class="time">
				{pending ? m.dm_sending() : format_clock(message.created_at, getLocale())}
			</div>
		{/if}
	</div>
	{#if !pending}
		<div class="tools" class:open={picking} bind:this={wrap}>
			<button
				type="button"
				class="icon-btn"
				aria-label={m.dm_react()}
				aria-expanded={picking}
				onclick={() => (picking = !picking)}
			>
				<Icon name="smile" size="sm" />
			</button>
			<button type="button" class="icon-btn" aria-label={m.dm_reply()} onclick={onreply}>
				<Icon name="corner-reply" size="sm" />
			</button>
			{#if picking}
				<div class="picker">
					{#each REACTIONS as emoji (emoji)}
						<button
							type="button"
							aria-label={m.dm_react_with({ emoji })}
							onclick={() => {
								picking = false
								onreact(emoji)
							}}>{emoji}</button
						>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.msg {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		max-width: 78%;
		position: relative;
	}
	.msg.first {
		margin-top: 6px;
	}
	.msg.mine {
		align-self: flex-end;
		flex-direction: row-reverse;
	}
	.msg.pending {
		opacity: 0.6;
	}
	.av {
		display: flex;
		flex: none;
		margin-bottom: 20px;
	}
	.ghost {
		width: 32px;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}
	.mine .col {
		align-items: flex-end;
	}
	.sender {
		font-size: 13px;
		color: var(--text-2);
		margin: 4px 0 2px 12px;
	}
	.bubble {
		background: var(--bg-3);
		padding: 9px 14px;
		border-radius: 20px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: 1.35;
	}
	.mine .bubble {
		background: var(--accent-fill);
		color: #fff;
	}
	.mine .bubble :global(.lnk) {
		color: #fff;
		text-decoration: underline;
	}
	.media {
		position: relative;
		width: 280px;
		max-width: 100%;
		max-height: 360px;
		border-radius: 18px;
		overflow: hidden;
		background: var(--img-fallback);
		margin-bottom: 2px;
	}
	.media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.badge {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 1px 5px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
	}
	.ref {
		display: flex;
		flex-direction: column;
		align-items: inherit;
		max-width: 260px;
		text-align: inherit;
	}
	.ref-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--text-2);
		margin: 6px 12px 3px;
	}
	.ref-body {
		max-width: 100%;
		font-size: 13px;
		color: var(--text-2);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 6px 12px 14px;
		margin-bottom: -10px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ref:hover .ref-body {
		background: var(--bg-2);
	}
	.reacts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: -6px;
		padding: 0 8px;
		position: relative;
		z-index: 1;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 12px;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 1px 7px;
	}
	.chip.me {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.time {
		font-size: 12px;
		color: var(--text-3);
		margin: 3px 12px 6px;
	}
	.tools {
		display: flex;
		align-self: center;
		position: relative;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.msg:hover .tools,
	.tools:focus-within,
	.tools.open {
		opacity: 1;
	}
	@media (hover: none) {
		.tools {
			opacity: 0.6;
		}
	}
	.tools .icon-btn {
		width: 30px;
		height: 30px;
		color: var(--text-2);
	}
	.picker {
		position: absolute;
		bottom: calc(100% + 4px);
		right: 0;
		z-index: 10;
		display: flex;
		gap: 2px;
		padding: 4px;
		background: var(--bg-elev);
		border: 1px solid var(--line);
		border-radius: 999px;
		box-shadow: var(--shadow-pop);
		animation: pop 0.16s var(--ease-out);
	}
	.mine .picker {
		right: auto;
		left: 0;
	}
	.picker button {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		font-size: 18px;
		transition:
			background-color 0.15s,
			transform 0.15s;
	}
	.picker button:hover {
		background: var(--bg-3);
		transform: scale(1.12);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.94);
		}
	}
	@media (max-width: 700px) {
		.msg {
			max-width: 88%;
		}
	}
</style>
