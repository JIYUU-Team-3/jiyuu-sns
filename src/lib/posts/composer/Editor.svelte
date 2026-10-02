<script lang="ts">
	import { onMount } from 'svelte'
	import { m } from '#lib/paraglide/messages.js'
	import { search_suggestions } from '#lib/search/search.remote'
	import type { TagView, UserView } from '#lib/search/types'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { complete, highlight_runs, typing_at } from '../compose'
	import { split_at_limit } from '../rules'
	import { accent_ranges } from '../text'

	let {
		value = $bindable(''),
		placeholder,
		size,
		autofocus = false,
		name,
		self,
		onkeydown,
	}: {
		value?: string
		placeholder: string
		/** `lg` for the modal, `md` inline on Home, `sm` in the reply box. */
		size: 'lg' | 'md' | 'sm'
		autofocus?: boolean
		name?: string
		/** The writer's account id, left out of mention suggestions. */
		self?: string
		onkeydown?: (event: KeyboardEvent) => void
	} = $props()

	const uid = $props.id()

	let textarea: HTMLTextAreaElement
	let stack = $state<HTMLElement>()

	const parts = $derived(split_at_limit(value))

	/** Put text at the caret (or over the selection), as typing it would. */
	export function insert(text: string) {
		textarea.focus()
		textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end')
		// `setRangeText` fires no input event, so tell `bind:value` and the counter.
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	}

	/*
	 * Suggestions while typing an @mention or a #tag, like X: the closest people, or tags in use.
	 */
	let caret = $state(0)
	let focused = $state(false)
	/** Where a mention or tag starts that the reader closed with Escape; it stays closed. */
	let dismissed = $state<number>()
	const typing = $derived(focused ? typing_at(value, caret) : undefined)
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
			.filter((user) => user.id !== self)
			.map((user) => ({ key: user.id, value: user.handle, user }))
	})
	let chosen = $state(0)
	const active = $derived(Math.min(chosen, picks.length - 1))

	/**
	 * The draft in runs for the mirror: links, #tags and @mentions in colour at their exact place
	 * in the text (links keep their `https://` here, unlike in a posted card), and anything past
	 * the limit marked.
	 */
	const runs = $derived(
		highlight_runs(
			value,
			parts[0].length,
			accent_ranges(value),
			suggesting ? [suggesting.start] : [],
		),
	)

	/** The start of the word being completed, in the mirror, to hang the list under. */
	let anchor = $state<HTMLElement>()
	let popover = $state<{ top: number; left: number }>()
	$effect(() => {
		void runs
		if (!anchor || !stack || !picks.length) {
			popover = undefined
			return
		}
		const width = Math.min(320, stack.clientWidth)
		popover = {
			top: anchor.offsetTop + anchor.offsetHeight + 6,
			left: Math.max(0, Math.min(anchor.offsetLeft, stack.clientWidth - width)),
		}
	})

	function sync_caret() {
		caret = textarea.selectionStart ?? 0
	}

	function pick(choice: Pick) {
		if (!suggesting) return
		const done = complete(value, suggesting, choice.value)
		// Write the textarea and move the caret at once, so the very next keystroke lands after it.
		textarea.value = done.text
		value = done.text
		textarea.focus()
		textarea.setSelectionRange(done.caret, done.caret)
		caret = done.caret
		chosen = 0
	}

	function keydown(event: KeyboardEvent) {
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
		onkeydown?.(event)
	}

	/** Grow with the text; the textarea never scrolls on its own. */
	$effect(() => {
		void value
		textarea.style.height = 'auto'
		textarea.style.height = `${textarea.scrollHeight}px`
	})

	onMount(() => {
		// An edit starts with the caret at the end.
		if (autofocus) textarea.setSelectionRange(value.length, value.length)
	})
</script>

<div class="editor {size}">
	<!-- Mirror, textarea and list share this box, so padding around the editor can't shift them. -->
	<div class="stack" bind:this={stack}>
		<!--
			The textarea's own text is transparent; this mirror under it paints the text, with links,
			hashtags and mentions in the accent colour and anything past the limit highlighted, like X.
		-->
		<!-- prettier-ignore -->
		<div class="mirror" aria-hidden="true">{#each runs as run (run.start)}{#if suggesting && run.start === suggesting.start}<span class="anchor" bind:this={anchor}></span>{/if}{#if run.over}<mark>{run.text}</mark>{:else if run.accent}<span class="accent">{run.text}</span>{:else}{run.text}{/if}{/each}&#8203;</div>
		<textarea
			{name}
			rows="1"
			{placeholder}
			aria-label={m.composer_label()}
			aria-autocomplete="list"
			aria-controls={picks.length ? `${uid}-suggest` : undefined}
			aria-activedescendant={picks.length ? `${uid}-s${active}` : undefined}
			bind:value
			bind:this={textarea}
			data-autofocus={autofocus ? '' : undefined}
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
			onkeydown={keydown}></textarea>
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
</div>

<style>
	.editor {
		font-size: 20px;
		line-height: 1.35;
	}
	.editor.sm {
		font-size: 17px;
	}
	.stack {
		position: relative;
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
		color: transparent;
		caret-color: var(--text);
		outline: 0;
		resize: none;
		overflow: hidden;
	}
	.lg textarea {
		min-height: 72px;
	}
	textarea::placeholder {
		color: var(--text-3);
	}
	textarea::selection {
		color: transparent;
		background: var(--accent-soft-2);
	}
	/* The whole composer is the field; the global focus ring would box the textarea alone. */
	textarea:focus-visible {
		outline: none;
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
</style>
