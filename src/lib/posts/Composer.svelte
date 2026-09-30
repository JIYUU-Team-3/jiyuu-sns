<script lang="ts">
	import { onMount } from 'svelte'
	import { getLocale } from '#lib/paraglide/runtime'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import { search_suggestions } from '#lib/search/search.remote'
	import type { TagView, UserView } from '#lib/search/types'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon, { type IconName } from '#lib/ui/Icon.svelte'
	import { toast } from '#lib/ui/toasts.svelte'
	import CharCounter from './CharCounter.svelte'
	import { complete, highlight_runs, typing_at } from './compose'
	import { format_age } from './format'
	import { post_href } from './links'
	import { create_post, edit_post } from './posts.remote'
	import PostText from './PostText.svelte'
	import { post_length, post_problem, split_at_limit } from './rules'
	import { current_time, edited_posts, type ComposerTask } from './state.svelte'
	import { accent_ranges } from './text'
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

	const uid = $props.id()

	let textarea: HTMLTextAreaElement
	let editor_element = $state<HTMLElement>()
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

	/*
	 * Suggestions while typing an @mention or a #tag, like X: the closest people, or tags in use.
	 */
	let caret = $state(0)
	let focused = $state(false)
	/** Where a mention or tag starts that the reader closed with Escape; it stays closed. */
	let dismissed = $state<number>()
	const typing = $derived(focused ? typing_at(text, caret) : undefined)
	const suggesting = $derived(typing && typing.start !== dismissed ? typing : undefined)
	const lookup_text = $derived(
		suggesting ? `${suggesting.kind === '#' ? '#' : ''}${suggesting.query}` : undefined,
	)

	/** The lookup, a moment after typing pauses, so each keystroke isn't a request. */
	let settled = $state<string>()
	$effect(() => {
		const next = lookup_text
		const timer = setTimeout(() => (settled = next), 120)
		return () => clearTimeout(timer)
	})
	const lookup = $derived(settled ? search_suggestions(settled) : undefined)
	/** The last answer, kept while the next one loads so the list doesn't flicker. */
	let found = $state<{ q: string; people: UserView[]; tags: TagView[] }>()
	$effect(() => {
		const current = lookup?.current
		if (current && settled) found = { q: settled, ...current }
	})

	type Pick = { key: string; value: string; user?: UserView; tag?: TagView }
	const picks = $derived.by((): Pick[] => {
		if (!suggesting || !lookup_text || !found) return []
		// An answer for an earlier, shorter prefix still fits while the new one loads.
		if (!lookup_text.toLowerCase().startsWith(found.q.toLowerCase())) return []
		if (suggesting.kind === '#') {
			return found.tags.map((tag) => ({ key: `#${tag.tag}`, value: tag.tag, tag }))
		}
		return found.people
			.filter((user) => user.id !== me.id)
			.map((user) => ({ key: user.id, value: user.handle, user }))
	})
	let chosen = $state(0)
	const active = $derived(Math.min(chosen, picks.length - 1))

	const runs = $derived(
		highlight_runs(
			text,
			parts[0].length,
			accent_ranges(text),
			suggesting ? [suggesting.start] : [],
		),
	)

	/** The start of the word being completed, in the mirror, to hang the list under. */
	let anchor = $state<HTMLElement>()
	let popover = $state<{ top: number; left: number }>()
	$effect(() => {
		void runs
		if (!anchor || !editor_element || !picks.length) {
			popover = undefined
			return
		}
		const width = Math.min(320, editor_element.clientWidth)
		popover = {
			top: anchor.offsetTop + anchor.offsetHeight + 6,
			left: Math.max(0, Math.min(anchor.offsetLeft, editor_element.clientWidth - width)),
		}
	})

	function sync_caret() {
		caret = textarea.selectionStart ?? 0
	}

	function pick(choice: Pick) {
		if (!suggesting) return
		const done = complete(text, suggesting, choice.value)
		// Write the textarea and move the caret at once, so the very next keystroke lands after it.
		textarea.value = done.text
		text = done.text
		textarea.focus()
		textarea.setSelectionRange(done.caret, done.caret)
		caret = done.caret
		chosen = 0
	}

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
		if (picks.length && suggesting) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault()
				const step = event.key === 'ArrowDown' ? 1 : -1
				chosen = (active + step + picks.length) % picks.length
				return
			}
			if ((event.key === 'Enter' && !event.metaKey && !event.ctrlKey) || event.key === 'Tab') {
				event.preventDefault()
				pick(picks[active])
				return
			}
			if (event.key === 'Escape') {
				// Close the list, not the modal around the composer.
				event.preventDefault()
				event.stopPropagation()
				dismissed = suggesting.start
				return
			}
		}
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
	<div class="editor" bind:this={editor_element}>
		<!--
			The textarea's own text is transparent; this mirror under it paints the draft instead,
			so links, #tags and @mentions show in colour and text past the limit is marked, like X.
		-->
		<div class="mirror" aria-hidden="true">
			{#each runs as run (run.start)}{#if suggesting && run.start === suggesting.start}<span
						class="anchor"
						bind:this={anchor}
					></span>{/if}{#if run.over}<mark>{run.text}</mark>{:else if run.accent}<span
						class="accent">{run.text}</span
					>{:else}{run.text}{/if}{/each}
		</div>
		<textarea
			name={create.fields.body.as('text').name}
			rows="1"
			{placeholder}
			aria-label={m.composer_label()}
			aria-autocomplete="list"
			aria-controls={picks.length ? `${uid}-suggest` : undefined}
			aria-activedescendant={picks.length ? `${uid}-s${active}` : undefined}
			bind:value={text}
			bind:this={textarea}
			data-autofocus={variant === 'modal' ? '' : undefined}
			oninput={() => {
				sync_caret()
				dismissed = undefined
				chosen = 0
			}}
			onkeyup={sync_caret}
			onclick={sync_caret}
			onfocus={() => {
				focused = true
				sync_caret()
			}}
			onblur={() => (focused = false)}
			{onkeydown}></textarea>
		{#if picks.length && popover}
			<!-- Options react to mousedown so the textarea keeps focus (and the caret) first. -->
			<ul
				class="suggest"
				id="{uid}-suggest"
				role="listbox"
				aria-label={m.search_suggestions()}
				style:top="{popover.top}px"
				style:left="{popover.left}px"
			>
				{#each picks as choice, i (choice.key)}
					<li
						id="{uid}-s{i}"
						role="option"
						aria-selected={i === active}
						class:active={i === active}
						onmousedown={(event) => {
							event.preventDefault()
							pick(choice)
						}}
						onmousemove={() => (chosen = i)}
					>
						{#if choice.user}
							<Avatar
								name={choice.user.name}
								seed={choice.user.id}
								image={choice.user.image}
								size={36}
							/>
							<span class="main">
								<b>{choice.user.name}</b>
								<span class="sub">@{choice.user.handle}</span>
							</span>
						{:else if choice.tag}
							<span class="lead"><Icon name="hash" /></span>
							<span class="main">
								<b>#{choice.tag.tag}</b>
								<span class="sub"
									>{choice.tag.posts === 1
										? m.profile_post({ count: choice.tag.posts })
										: m.profile_posts({ count: choice.tag.posts })}</span
								>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
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
		color: var(--text);
		pointer-events: none;
	}
	.accent {
		color: var(--accent-text);
	}
	mark {
		color: inherit;
		background: var(--danger-soft);
		border-radius: 2px;
	}
	.anchor {
		display: inline-block;
		width: 0;
		height: 1.35em;
		vertical-align: top;
	}
	textarea {
		position: relative;
		display: block;
		width: 100%;
		min-height: 1.35em;
		background: none;
		/* The mirror shows the text; the textarea only keeps the caret and the selection. */
		color: transparent;
		caret-color: var(--text);
		outline: 0;
		resize: none;
		overflow: hidden;
	}
	textarea::selection {
		color: transparent;
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	/* ---------- Mention and tag suggestions ---------- */
	.suggest {
		position: absolute;
		z-index: 30;
		width: min(320px, 100%);
		margin: 0;
		padding: 6px 0;
		list-style: none;
		max-height: 280px;
		overflow-y: auto;
		font-size: 15px;
		line-height: 1.3;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 16px;
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
	}
	.suggest li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		cursor: pointer;
	}
	.suggest li.active {
		background: var(--bg-2);
	}
	.suggest .lead {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: none;
		color: var(--text-2);
	}
	.suggest .main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.suggest b,
	.suggest .sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.suggest .sub {
		color: var(--text-2);
		font-size: 14px;
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
	/* The mirror fills the padding box; start it where the textarea's text starts. */
	.inline .mirror {
		inset: 6px 0;
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
