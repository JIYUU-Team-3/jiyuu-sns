<script lang="ts">
	import { refusal_message } from '#lib/moderation/refusals'
	import { onDestroy, onMount } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import CharCounter from './CharCounter.svelte'
	import Attachments from './composer/Attachments.svelte'
	import AudiencePicker from './composer/AudiencePicker.svelte'
	import type { Draft } from './composer/draft.svelte'
	import Editor from './composer/Editor.svelte'
	import MediaTray from './composer/MediaTray.svelte'
	import { Thread } from './composer/thread.svelte'
	import Tools from './composer/Tools.svelte'
	import { pick_files } from './composer/pick'
	import { format_age } from './format'
	import { post_href } from './links'
	import { create_post, create_thread, edit_post } from './posts.remote'
	import PostText from './PostText.svelte'
	import { post_length } from './rules'
	import {
		current_time,
		edited_posts,
		post_content,
		timeline,
		type ComposerTask,
	} from './state.svelte'
	import type { Author } from './types'

	let {
		task,
		me,
		variant,
		thread = new Thread(),
		onclose,
		ondone,
	}: {
		task: ComposerTask
		me: Author
		/** `modal`: the full composer; `inline`: top of Home; `reply`: under a focused post. */
		variant: 'modal' | 'inline' | 'reply'
		/** Passed in by the modal so it can ask before discarding it. */
		thread?: Thread
		onclose?: () => void
		/** After a successful post or save. */
		ondone?: () => void
	} = $props()

	const draft = $derived(thread.posts[0])
	const many = $derived(thread.posts.length > 1)
	const reply_to = $derived(task.kind === 'reply' ? task.post : undefined)
	const editing = $derived(task.kind === 'edit')
	const attachments = $derived(!editing)
	const audience = $derived(!editing && !reply_to)

	const editors: Editor[] = []
	let busy = $state(false)
	let hydrated = $state(false)

	const length = $derived(post_length(thread.current.text))
	/** What the post shows now, for an edit: saving that again would change nothing. */
	const before = $derived(task.kind === 'edit' ? post_content(task.post) : undefined)
	const ready = $derived(
		!busy && (before ? draft.edit_ready && !draft.matches(before) : thread.ready),
	)

	const submit_label = $derived(
		editing
			? m.composer_save()
			: reply_to
				? many
					? m.composer_reply_all()
					: m.composer_reply()
				: many
					? m.composer_post_all()
					: m.composer_post(),
	)
	const placeholder = $derived(reply_to ? m.composer_reply_placeholder() : m.composer_placeholder())

	async function publish() {
		const thread_post = many
		const reply_audience = audience ? thread.audience : undefined
		const post = thread_post
			? await create_thread({ posts: thread.payload(), reply_to: reply_to?.id, reply_audience })
			: await create_post({ ...draft.payload(), reply_to: reply_to?.id, reply_audience })
		thread.clear()
		if (!reply_to) timeline.published(post)
		const message = reply_to
			? m.toast_replied()
			: thread_post
				? m.toast_thread_posted()
				: m.toast_posted()
		toast.show(message, {
			label: m.toast_view(),
			href: post_href(post.id),
		})
	}

	/** Save new text and, if they changed, the photos left, their order and descriptions. */
	async function save() {
		if (task.kind !== 'edit' || !before) return
		const media = draft.media_payload()
		await edit_post({
			id: task.post.id,
			body: draft.trimmed,
			media: draft.media_matches(before.media)
				? undefined
				: media.map(({ url, alt }) => ({ url, alt })),
		})
		edited_posts.set(task.post.id, { body: draft.trimmed, media })
		toast.show(m.toast_updated())
	}

	async function submit(event?: SubmitEvent) {
		event?.preventDefault()
		if (!ready) return
		busy = true
		try {
			await (editing ? save() : publish())
			ondone?.()
		} catch (cause) {
			toast.show(refusal_message(cause, m.toast_error))
		} finally {
			busy = false
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault()
			void submit()
		}
	}

	function onpaste(event: ClipboardEvent, post: Draft) {
		const files = [...(event.clipboardData?.files ?? [])]
		if (!attachments || !files.length) return
		event.preventDefault()
		void pick_files(post, files)
	}

	onMount(() => (hydrated = true))
	onDestroy(() => thread.discard())
</script>

{#snippet editor_field(post: Draft, i: number)}
	<Editor
		bind:this={editors[i]}
		bind:value={post.text}
		placeholder={i ? m.composer_thread_placeholder() : placeholder}
		size={variant === 'modal' ? (i ? 'md' : 'lg') : variant === 'inline' ? 'md' : 'sm'}
		autofocus={variant === 'modal' && i === thread.focus}
		self={me.id}
		{onkeydown}
		onpaste={(event) => onpaste(event, post)}
	/>
	{#if attachments}
		<Attachments draft={post} oninsert={(text) => editors[i].insert(text)} />
	{:else if editing}
		<!-- An edit can drop or reorder the post's photos, but not add any. -->
		<MediaTray {draft} />
	{/if}
{/snippet}

{#snippet submit_button()}
	<!-- Until hydration nothing can publish, so the button waits too. -->
	<button class="btn btn-primary sm" disabled={!hydrated || !ready}>{submit_label}</button>
{/snippet}

<form class="composer {variant}" method="post" onsubmit={submit}>
	{#if variant === 'modal'}
		<div class="head">
			<button type="button" class="icon-btn" aria-label={m.composer_close()} onclick={onclose}>
				<Icon name="x" />
			</button>
			<span class="grow"></span>
			{@render submit_button()}
		</div>
		<div class="body">
			{#if reply_to}
				<div class="parent">
					<div class="gutter">
						<Avatar
							name={reply_to.author.name}
							seed={reply_to.author.id}
							image={reply_to.author.image}
						/>
						<div class="thread-line"></div>
					</div>
					<div class="parent-body">
						<div class="parent-head">
							<b class="nm">{reply_to.author.name}</b>
							{#if reply_to.author.handle}<span class="meta">@{reply_to.author.handle}</span>{/if}
							<span class="meta"
								>· {format_age(reply_to.created_at, current_time(), getLocale())}</span
							>
						</div>
						<div class="parent-text"><PostText body={reply_to.body} /></div>
						{#if reply_to.author.handle}
							<div class="replying">
								{#each m.composer_replying_to.parts() as part, i (i)}
									{#if part.type === 'text'}{part.value}{:else if part.name === 'handle'}<span
											class="lnk">@{reply_to.author.handle}</span
										>{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
			{#each thread.posts as post, i (post)}
				<div
					class="row"
					class:linked={i < thread.posts.length - 1}
					onfocusin={() => (thread.focus = i)}
				>
					<div class="gutter">
						<Avatar name={me.name} seed={me.id} image={me.image} />
						{#if i < thread.posts.length - 1}<div class="thread-line"></div>{/if}
					</div>
					<div class="field">{@render editor_field(post, i)}</div>
					{#if i > 0}
						<button
							type="button"
							class="icon-btn remove"
							aria-label={m.composer_remove_post()}
							onclick={() => thread.remove(i)}
						>
							<Icon name="x" size="sm" />
						</button>
					{/if}
				</div>
			{/each}
			{#if audience}
				<div class="audience"><AudiencePicker bind:value={thread.audience} /></div>
			{/if}
			{#if editing}
				<div class="editing-note"><Icon name="pencil" size="xs" />{m.composer_editing_note()}</div>
			{/if}
		</div>
		<div class="toolbar">
			{#if attachments}<Tools draft={thread.current} />{/if}
			<span class="grow"></span>
			<CharCounter {length} />
			{#if !editing}
				<span class="vsep"></span>
				<button
					type="button"
					class="add-thread"
					aria-label={m.composer_add_post()}
					title={m.composer_add_post()}
					disabled={!thread.can_add}
					onclick={() => thread.add()}
				>
					<Icon name="plus" size="sm" />
				</button>
			{/if}
		</div>
	{:else}
		{#if me.handle}
			<!-- A pointer shortcut only: the nav's Profile link already serves keyboards and screen readers. -->
			<a class="av-link" href={profile_href(me.handle)} tabindex="-1" aria-hidden="true">
				<Avatar name={me.name} seed={me.id} image={me.image} />
			</a>
		{:else}
			<Avatar name={me.name} seed={me.id} image={me.image} />
		{/if}
		<div class="col">
			{@render editor_field(draft, 0)}
			{#if variant === 'inline' && audience && draft.dirty}
				<div class="audience inline-audience"><AudiencePicker bind:value={thread.audience} /></div>
			{/if}
			{#if variant === 'inline' || variant === 'reply'}
				<div class="row-end">
					<Tools {draft} />
					<span class="grow"></span>
					{#if draft.text}<CharCounter {length} /><span class="vsep"></span>{/if}
					{@render submit_button()}
				</div>
			{/if}
		</div>
	{/if}
</form>

<style>
	.grow {
		flex: 1;
	}

	/* ---------- Modal ---------- */
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		min-height: 53px;
	}
	.body {
		padding: 4px 16px 0;
	}
	.row,
	.parent {
		display: flex;
		gap: 12px;
	}
	.gutter {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: none;
	}
	.thread-line {
		width: 2px;
		flex: 1;
		background: var(--line-2);
		margin-top: 4px;
		min-height: 12px;
		border-radius: 1px;
	}
	.parent-body {
		flex: 1;
		min-width: 0;
		padding-bottom: 12px;
	}
	.parent-head {
		display: flex;
		gap: 4px;
		line-height: 20px;
		min-width: 0;
	}
	.parent-head .nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		color: var(--text-2);
		white-space: nowrap;
	}
	.parent-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin-top: 2px;
	}
	.replying {
		color: var(--text-2);
		margin-top: 12px;
	}
	.field {
		flex: 1;
		min-width: 0;
		padding-top: 6px;
	}
	.linked .field {
		padding-bottom: 12px;
	}
	.remove {
		align-self: flex-start;
	}
	.add-thread {
		color: var(--accent-text);
		border: 1px solid var(--line-2);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		transition: background-color 0.15s;
	}
	.add-thread:hover:not(:disabled) {
		background: var(--accent-soft);
	}
	.add-thread:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.audience {
		padding: 8px 0 0 52px;
	}
	.inline-audience {
		padding: 4px 0 0;
	}
	.editing-note {
		display: flex;
		gap: 8px;
		align-items: center;
		font-size: 13px;
		color: var(--text-2);
		padding: 8px 0 0 52px;
	}
	.toolbar {
		display: flex;
		align-items: center;
		padding: 8px 24px 10px 60px;
		border-top: 1px solid var(--line);
		margin-top: 10px;
	}

	.av-link {
		display: flex;
		align-self: flex-start;
		border-radius: 50%;
	}
	.reply .av-link {
		align-self: center;
	}

	/* ---------- Inline (Home) ---------- */
	.inline {
		display: flex;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
	}
	.inline :global(.editor) {
		padding: 6px 0;
	}
	.col {
		flex: 1;
		min-width: 0;
	}
	.row-end {
		display: flex;
		align-items: center;
		margin-top: 4px;
	}
	.vsep {
		width: 1px;
		height: 28px;
		background: var(--line-2);
		margin: 0 12px;
	}

	/* ---------- Reply box (post page) ---------- */
	.reply {
		display: flex;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line);
		align-items: center;
	}

	@media (max-width: 700px) {
		.toolbar {
			padding-left: 8px;
			flex-wrap: wrap;
		}
		/* Phones compose from the floating button, as in the mockup. */
		.inline {
			display: none;
		}
	}
</style>
