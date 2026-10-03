<script lang="ts">
	import { IMAGE_ACCEPT, image_problem } from '#lib/media'
	import { m } from '#lib/paraglide/messages.js'
	import GifPicker from '#lib/posts/composer/GifPicker.svelte'
	import { discard_upload, measure } from '#lib/posts/composer/upload'
	import { post_length } from '#lib/posts/rules'
	import type { Gif } from '#lib/posts/types'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { MESSAGE_MAX } from './rules'
	import type { MessageMedia, MessageView, OutgoingMessage } from './types'
	import { upload_message_photo } from './upload'

	type Attachment = {
		kind: MessageMedia['kind']
		preview: string
		url?: string
		width: number
		height: number
	}

	let {
		replying,
		oncancelreply,
		onsend,
		ontyping,
	}: {
		replying?: MessageView
		oncancelreply: () => void
		onsend: (message: OutgoingMessage) => Promise<boolean>
		ontyping?: (typing: boolean) => void
	} = $props()

	let body = $state('')
	let attachment = $state<Attachment>()
	let gif_open = $state(false)
	let file_input = $state<HTMLInputElement>()
	let field = $state<HTMLTextAreaElement>()

	const text = $derived(body.trim())
	const too_long = $derived(post_length(text) > MESSAGE_MAX)
	const uploading = $derived(!!attachment && !attachment.url)
	const can_send = $derived((!!text || !!attachment?.url) && !too_long && !uploading)

	const reply_name = $derived(replying ? (replying.mine ? m.dm_you() : replying.sender.name) : '')
	const reply_text = $derived(
		replying ? replying.body || (replying.media?.kind === 'gif' ? m.dm_gif() : m.dm_photo()) : '',
	)

	$effect(() => {
		if (replying) field?.focus()
	})

	$effect(() => {
		ontyping?.(!!body.trim())
	})

	function clear_attachment(discard: boolean) {
		if (!attachment) return
		if (attachment.kind === 'image') {
			URL.revokeObjectURL(attachment.preview)
			if (discard && attachment.url) discard_upload(attachment.url)
		}
		attachment = undefined
	}

	async function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		input.value = ''
		if (!file) return
		const problem = await image_problem(file, 'message')
		if (problem === 'type') return toast.show(m.onboarding_image_type())
		if (problem === 'size') return toast.show(m.dm_photo_size())

		clear_attachment(true)
		gif_open = false
		const size = await measure(file).catch(() => ({ width: 1, height: 1 }))
		const next: Attachment = { kind: 'image', preview: URL.createObjectURL(file), ...size }
		attachment = next
		try {
			const url = await upload_message_photo(file)
			if (attachment?.preview === next.preview) attachment = { ...next, url }
			else discard_upload(url)
		} catch {
			if (attachment?.preview === next.preview) clear_attachment(false)
			toast.show(m.composer_upload_failed())
		}
	}

	function pick_gif(gif: Gif) {
		clear_attachment(true)
		attachment = {
			kind: 'gif',
			preview: gif.preview.url,
			url: gif.full.url,
			width: gif.full.width,
			height: gif.full.height,
		}
		gif_open = false
		field?.focus()
	}

	async function submit(event?: SubmitEvent) {
		event?.preventDefault()
		if (!can_send) return
		const sent_body = text
		const sent = attachment
		const media =
			sent?.url && sent.width > 0 && sent.height > 0
				? { kind: sent.kind, url: sent.url, width: sent.width, height: sent.height }
				: undefined
		body = ''
		attachment = undefined
		const ok = await onsend({ body: sent_body, media })
		if (ok) {
			if (sent?.kind === 'image') URL.revokeObjectURL(sent.preview)
		} else {
			body = sent_body
			attachment = sent
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
		event.preventDefault()
		void submit()
	}
</script>

<form class="compose" onsubmit={submit}>
	{#if replying}
		<div class="replying">
			<Icon name="corner-reply" size="xs" />
			<span class="grow">{m.dm_replying_to({ name: reply_name })}: {reply_text}</span>
			<button
				type="button"
				class="icon-btn"
				aria-label={m.dm_cancel_reply()}
				onclick={oncancelreply}
			>
				<Icon name="x" size="xs" />
			</button>
		</div>
	{/if}
	{#if gif_open}
		<GifPicker onpick={pick_gif} />
	{/if}
	{#if attachment}
		<div class="attach">
			<div class="thumb" class:loading={!attachment.url}>
				<img src={attachment.preview} alt="" />
				{#if attachment.kind === 'gif'}<span class="badge" aria-hidden="true">GIF</span>{/if}
				{#if !attachment.url}<span class="sr" role="status">{m.composer_uploading()}</span>{/if}
				<button
					type="button"
					aria-label={m.dm_remove_attachment()}
					onclick={() => clear_attachment(true)}
				>
					<Icon name="x" size="xs" />
				</button>
			</div>
		</div>
	{/if}
	<div class="field">
		<button
			type="button"
			class="icon-btn accent"
			aria-label={m.dm_add_photo()}
			onclick={() => file_input?.click()}
		>
			<Icon name="image" />
		</button>
		<input type="file" accept={IMAGE_ACCEPT} hidden bind:this={file_input} onchange={pick} />
		<button
			type="button"
			class="icon-btn accent"
			aria-label={m.composer_add_gif()}
			aria-pressed={gif_open}
			onclick={() => (gif_open = !gif_open)}
		>
			<Icon name="gif" />
		</button>
		<textarea
			rows="1"
			placeholder={m.dm_placeholder()}
			aria-label={m.dm_label()}
			bind:value={body}
			bind:this={field}
			{onkeydown}></textarea>
		<button class="icon-btn accent" aria-label={m.dm_send()} disabled={!can_send}>
			<Icon name="send" />
		</button>
	</div>
	{#if too_long}
		<p class="error" role="alert">{m.dm_too_long({ count: MESSAGE_MAX })}</p>
	{/if}
</form>

<style>
	.compose {
		border-top: 1px solid var(--line);
		padding: 8px 12px calc(8px + var(--chat-inset, env(safe-area-inset-bottom)));
		background: var(--bg);
	}
	.replying {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
		padding: 0 6px 6px;
	}
	.grow {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.replying .icon-btn {
		width: 28px;
		height: 28px;
	}
	.attach {
		display: flex;
		gap: 8px;
		padding: 0 4px 8px;
	}
	.thumb {
		position: relative;
		width: 72px;
		height: 72px;
		border-radius: 12px;
		overflow: hidden;
		background: var(--img-fallback);
	}
	.thumb.loading img {
		opacity: 0.5;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumb button {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		display: grid;
		place-items: center;
	}
	.badge {
		position: absolute;
		left: 4px;
		bottom: 4px;
		padding: 0 4px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		font-size: 10px;
		font-weight: 700;
	}
	.field {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		background: var(--bg-3);
		border-radius: 22px;
		padding: 4px 4px 4px 6px;
	}
	.field:focus-within {
		box-shadow: 0 0 0 1px var(--accent);
	}
	.accent {
		color: var(--accent-text);
	}
	.accent:hover {
		background: var(--accent-soft);
	}
	.accent[aria-pressed='true'] {
		background: var(--accent-soft);
	}
	textarea {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		resize: none;
		padding: 8px 6px;
		line-height: 20px;
		max-height: 132px;
		field-sizing: content;
	}
	@media (pointer: coarse) {
		textarea {
			font-size: 16px;
		}
	}
	textarea::placeholder {
		color: var(--text-3);
	}
	.error {
		margin: 6px 6px 0;
		font-size: 13px;
		color: var(--danger);
	}
</style>
