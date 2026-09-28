<script lang="ts">
	import { onMount } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon, { type IconName } from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import CharCounter from './CharCounter.svelte'
	import { format_age } from './format'
	import { post_href } from './links'
	import { create_post, edit_post } from './posts.remote'
	import PostText from './PostText.svelte'
	import { post_length, post_problem, split_at_limit } from './rules'
	import { current_time, edited_posts, type ComposerTask } from './state.svelte'
	import type { Author } from './types'

	let {
		task,
		me,
		variant,
		text = $bindable(''),
		onclose,
		ondone,
	}: {
		task: ComposerTask
		me: Author
		/** `modal`: the full composer; `inline`: top of Home; `reply`: under a focused post. */
		variant: 'modal' | 'inline' | 'reply'
		/** The draft, bound so the modal can ask before discarding it. */
		text?: string
		onclose?: () => void
		/** After a successful post or save. */
		ondone?: () => void
	} = $props()

	// An edit starts from the post's current text; this runs once, when the composer opens.
	// svelte-ignore state_referenced_locally
	if (task.kind === 'edit' && !text) text = edited_posts.get(task.post.id) ?? task.post.body

	const reply_to = $derived(task.kind === 'reply' ? task.post : undefined)
	const editing = $derived(task.kind === 'edit')

	let textarea: HTMLTextAreaElement
	let form_element: HTMLFormElement
	let busy = $state(false)
	// Without JavaScript nothing re-enables the button, so it stays usable until hydration and
	// the server rejects anything invalid.
	let hydrated = $state(false)

	const trimmed = $derived(text.trim())
	const length = $derived(post_length(text))
	const unchanged = $derived(
		task.kind === 'edit' && trimmed === (edited_posts.get(task.post.id) ?? task.post.body),
	)
	const ready = $derived(!busy && !post_problem(trimmed) && !unchanged)
	const parts = $derived(split_at_limit(text))

	const submit_label = $derived(
		editing ? m.composer_save() : reply_to ? m.composer_reply() : m.composer_post(),
	)
	const placeholder = $derived(reply_to ? m.composer_reply_placeholder() : m.composer_placeholder())

	/*
	 * One remote form instance per composer, so Home's inline box and the modal don't share state.
	 * Field names come from `create.fields` (Kit tags them with the form's id); the value stays
	 * bound to `text` because the counter and the overflow mirror need it on every keystroke.
	 */
	const create = $derived(
		create_post.for(reply_to ? `reply:${reply_to.id}:${variant}` : `new:${variant}`),
	)

	const publish = $derived(
		create.enhance(async ({ submit }) => {
			busy = true
			try {
				if (!(await submit())) {
					toast.show(m.toast_error())
					return
				}
				const id = create.result?.id
				text = ''
				toast.show(
					reply_to ? m.toast_replied() : m.toast_posted(),
					id ? { label: m.toast_view(), href: post_href(id) } : undefined,
				)
				ondone?.()
			} catch {
				toast.show(m.toast_error())
			} finally {
				busy = false
			}
		}),
	)

	async function save(event: SubmitEvent) {
		event.preventDefault()
		if (!ready || task.kind !== 'edit') return
		busy = true
		try {
			await edit_post({ id: task.post.id, body: trimmed })
			edited_posts.set(task.post.id, trimmed)
			toast.show(m.toast_updated())
			ondone?.()
		} catch {
			toast.show(m.toast_error())
		} finally {
			busy = false
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault()
			if (ready) form_element.requestSubmit()
		}
	}

	/** Grow with the text; the textarea never scrolls on its own. */
	$effect(() => {
		void text
		textarea.style.height = 'auto'
		textarea.style.height = `${textarea.scrollHeight}px`
	})

	onMount(() => {
		hydrated = true
		// The modal focuses the textarea (data-autofocus); an edit starts with the caret at the end.
		if (variant === 'modal') textarea.setSelectionRange(text.length, text.length)
	})

	const TOOLS: [IconName, () => string][] = [
		['image', m.composer_add_photos],
		['gif', m.composer_add_gif],
		['poll', m.composer_add_poll],
		['smile', m.composer_add_emoji],
		['pin', m.composer_add_location],
	]
</script>

{#snippet editor()}
	<div class="editor">
		<!-- A mirror under the transparent textarea paints the text past the limit, like X. -->
		<div class="mirror" aria-hidden="true">{parts[0]}<mark>{parts[1]}</mark></div>
		<textarea
			name={create.fields.body.as('text').name}
			rows="1"
			{placeholder}
			aria-label={m.composer_label()}
			bind:value={text}
			bind:this={textarea}
			data-autofocus={variant === 'modal' ? '' : undefined}
			{onkeydown}></textarea>
	</div>
{/snippet}

{#snippet tools()}
	<div class="tools">
		{#each TOOLS as [icon, label] (icon)}
			<!-- Media, polls and places come with later features; they stay visible, as designed. -->
			<button
				type="button"
				class="icon-btn"
				aria-disabled="true"
				aria-label="{label()} ({m.composer_coming_soon()})"
				title={m.composer_coming_soon()}
				onclick={() => toast.show(m.toast_coming_soon())}
			>
				<Icon name={icon} />
			</button>
		{/each}
	</div>
{/snippet}

{#snippet submit_button()}
	<button class="btn btn-primary sm" disabled={hydrated && !ready}>{submit_label}</button>
{/snippet}

<form
	class="composer {variant}"
	bind:this={form_element}
	{...editing ? { method: 'post', onsubmit: save } : publish}
>
	{#if reply_to}<input {...create.fields.reply_to.as('hidden', reply_to.id)} />{/if}

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
			<div class="row">
				<div class="gutter"><Avatar name={me.name} seed={me.id} image={me.image} /></div>
				<div class="field">{@render editor()}</div>
			</div>
			{#if editing}
				<div class="editing-note"><Icon name="pencil" size="xs" />{m.composer_editing_note()}</div>
			{/if}
		</div>
		<div class="toolbar">
			{@render tools()}
			<span class="grow"></span>
			<CharCounter {length} />
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
			{@render editor()}
			{#if variant === 'inline'}
				<div class="row-end">
					{@render tools()}
					<span class="grow"></span>
					{#if text}<CharCounter {length} /><span class="vsep"></span>{/if}
					{@render submit_button()}
				</div>
			{/if}
		</div>
		{#if variant === 'reply'}
			{#if text}<CharCounter {length} />{/if}
			{@render submit_button()}
		{/if}
	{/if}
</form>

<style>
	.grow {
		flex: 1;
	}

	/* ---------- Editor ---------- */
	.editor {
		position: relative;
		font-size: 20px;
		line-height: 1.35;
	}
	.reply .editor {
		font-size: 17px;
	}
	.mirror,
	textarea {
		font: inherit;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		padding: 0;
		margin: 0;
		border: 0;
	}
	.mirror {
		position: absolute;
		inset: 0;
		color: transparent;
		pointer-events: none;
	}
	mark {
		color: transparent;
		background: var(--danger-soft);
		border-radius: 2px;
	}
	textarea {
		position: relative;
		display: block;
		width: 100%;
		min-height: 1.35em;
		background: none;
		color: var(--text);
		outline: 0;
		resize: none;
		overflow: hidden;
	}
	.modal textarea {
		min-height: 72px;
	}
	textarea::placeholder {
		color: var(--text-3);
	}
	/* The whole composer is the field; the global focus ring would box the textarea alone. */
	textarea:focus-visible {
		outline: none;
	}

	.tools {
		display: flex;
		margin-left: -8px;
	}
	.tools .icon-btn {
		color: var(--accent-text);
	}
	.tools .icon-btn:hover {
		background: var(--accent-soft);
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
	.inline .editor {
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
