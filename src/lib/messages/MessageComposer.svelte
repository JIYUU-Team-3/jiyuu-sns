<script lang="ts">
	import { onDestroy } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import GifPicker from '#lib/posts/composer/GifPicker.svelte'
	import { discard_upload, measure } from '#lib/posts/composer/upload'
	import { post_length } from '#lib/posts/rules'
	import type { Gif } from '#lib/posts/types'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import { MESSAGE_MAX } from './rules'
	import { MESSAGE_FILE_MAX_BYTES, file_size, message_file_kind, message_file_name } from './files'
	import type { MessageMedia, MessageView, OutgoingMessage } from './types'
	import { upload_message_file } from './upload'

	type Attachment =
		| { kind: 'image' | 'gif'; preview: string; url?: string; width: number; height: number }
		| { kind: 'file'; url?: string; name: string; size: number }

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
	let selection = 0
	let checking = $state(false)

	const text = $derived(body.trim())
	const too_long = $derived(post_length(text) > MESSAGE_MAX)
	const uploading = $derived(checking || (!!attachment && !attachment.url))
	const can_send = $derived((!!text || !!attachment?.url) && !too_long && !uploading)

	const reply_name = $derived(replying ? (replying.mine ? m.dm_you() : replying.sender.name) : '')
	const reply_text = $derived(
		replying
			? replying.body ||
					(replying.media?.kind === 'file'
						? m.dm_file()
						: replying.media?.kind === 'gif'
							? m.dm_gif()
							: m.dm_photo())
			: '',
	)

	$effect(() => {
		if (replying) field?.focus()
	})

	$effect(() => {
		ontyping?.(!!body.trim())
	})

	function clear_attachment(discard: boolean) {
		selection++
		checking = false
		if (!attachment) return
		if (attachment.kind === 'image') {
			URL.revokeObjectURL(attachment.preview)
		}
		if (discard && attachment.kind !== 'gif' && attachment.url) discard_upload(attachment.url)
		attachment = undefined
	}

	onDestroy(() => clear_attachment(true))

	async function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement
		const file = input.files?.[0]
		input.value = ''
		if (!file) return
		await attach_file(file)
	}

	function onpaste(event: ClipboardEvent) {
		const file = event.clipboardData?.files[0]
		if (!file) return
		event.preventDefault()
		void attach_file(file)
	}

	async function attach_file(file: File) {
		if (file.size > MESSAGE_FILE_MAX_BYTES) return toast.show(m.dm_file_size())
		clear_attachment(true)
		const current = selection
		checking = true
		gif_open = false
		try {
			const kind = await message_file_kind(file)
			const size =
				kind === 'image' ? await measure(file).catch(() => ({ width: 1, height: 1 })) : undefined
			if (selection !== current) return
			const next: Attachment = size
				? { kind: 'image', preview: URL.createObjectURL(file), ...size }
				: { kind: 'file', name: message_file_name(file.name), size: file.size }
			attachment = next
			checking = false
			const url = await upload_message_file(file)
			if (selection === current) attachment = { ...next, url }
			else discard_upload(url)
		} catch {
			if (selection === current) {
				clear_attachment(false)
				toast.show(m.composer_upload_failed())
			}
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
		const media: MessageMedia | undefined = sent?.url
			? sent.kind === 'file'
				? { kind: 'file', url: sent.url, name: sent.name, size: sent.size }
				: { kind: sent.kind, url: sent.url, width: sent.width, height: sent.height }
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
			<div class="thumb" class:file={attachment.kind === 'file'} class:loading={!attachment.url}>
				{#if attachment.kind === 'file'}
					<span class="file-name">{attachment.name}</span>
					<small>{file_size(attachment.size)}</small>
				{:else}
					<img src={attachment.preview} alt="" />
				{/if}
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
			aria-label={m.dm_add_file()}
			onclick={() => file_input?.click()}
		>
			<Icon name="plus" />
		</button>
		<input type="file" hidden bind:this={file_input} onchange={pick} />
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
			{onkeydown}
			{onpaste}></textarea>
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
		padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
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
	.thumb.file {
		width: min(260px, 100%);
		height: auto;
		min-height: 72px;
		padding: 12px 34px 12px 12px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
	}
	.file-name {
		overflow-wrap: anywhere;
		font-size: 14px;
	}
	.thumb small {
		color: var(--text-2);
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
	textarea::placeholder {
		color: var(--text-3);
	}
	.error {
		margin: 6px 6px 0;
		font-size: 13px;
		color: var(--danger);
	}
</style>
