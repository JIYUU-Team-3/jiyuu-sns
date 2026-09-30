<script lang="ts">
	import { goto } from '$app/navigation'
	import { m } from '#lib/paraglide/messages.js'
	import { profile_href } from '#lib/profiles/links'
	import Avatar from '#lib/ui/Avatar.svelte'
	import Icon from '#lib/ui/Icon.svelte'
	import { search_href, tag_href } from './links'
	import { search_suggestions } from './search.remote'
	import type { TagView, UserView } from './types'

	let { value = '' }: { value?: string } = $props()

	const id = $props.id()

	// Follows the page's query, but the reader can type over it.
	let q = $derived(value)
	let focused = $state(false)
	let dismissed = $state(false)
	/** Which option the arrow keys are on; -1 is none (Enter then searches). */
	let active = $state(-1)

	/** What was typed, a moment after typing pauses, so each keystroke isn't a request. */
	let settled = $state('')
	$effect(() => {
		const text = q.trim()
		const timer = setTimeout(() => (settled = text), 150)
		return () => clearTimeout(timer)
	})

	const query = $derived(settled ? search_suggestions(settled) : undefined)
	/** The last answer, kept on screen while the next one loads so the list doesn't flicker. */
	let found = $state<{ q: string; people: UserView[]; tags: TagView[] }>()
	$effect(() => {
		const current = query?.current
		if (current) found = { q: settled, ...current }
	})

	type Option =
		| { kind: 'search'; href: string }
		| { kind: 'person'; href: string; user: UserView }
		| { kind: 'tag'; href: string; tag: TagView }

	const options = $derived.by((): Option[] => {
		const text = q.trim()
		if (!text) return []
		const matches = found && found.q && text.toLowerCase().startsWith(found.q.toLowerCase())
		return [
			{ kind: 'search', href: search_href(text) },
			...(matches ? found!.people : []).map((user): Option => ({
				kind: 'person',
				href: profile_href(user.handle),
				user,
			})),
			...(matches ? found!.tags : []).map((tag): Option => ({
				kind: 'tag',
				href: tag_href(tag.tag),
				tag,
			})),
		]
	})

	const open = $derived(focused && !dismissed && options.length > 0)

	function go(href: string) {
		dismissed = true
		active = -1
		;(document.activeElement as HTMLElement | null)?.blur()
		goto(href)
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault()
		const option = options[active]
		if (option) go(option.href)
		else if (q.trim()) go(search_href(q.trim()))
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (open) event.preventDefault()
			dismissed = true
			active = -1
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!options.length) return
			event.preventDefault()
			dismissed = false
			const step = event.key === 'ArrowDown' ? 1 : -1
			active = (active + step + options.length + 1) % (options.length + 1)
			if (active === options.length) active = -1
		}
	}

	function oninput() {
		dismissed = false
		active = -1
	}
</script>

<form class="search" role="search" {onsubmit}>
	<Icon name="search" size="sm" />
	<input
		type="search"
		name="q"
		bind:value={q}
		placeholder={m.search_placeholder()}
		aria-label={m.search_label()}
		autocomplete="off"
		maxlength="100"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		{onkeydown}
		{oninput}
	/>

	{#if open}
		<!-- Options react to mousedown so the input doesn't lose focus (and close the list) first. -->
		<ul class="list" id="{id}-list" role="listbox" aria-label={m.search_suggestions()}>
			{#each options as option, i (`${option.kind}:${option.href}`)}
				<li
					id="{id}-{i}"
					role="option"
					aria-selected={i === active}
					class:active={i === active}
					onmousedown={(event) => {
						event.preventDefault()
						go(option.href)
					}}
					onmousemove={() => (active = i)}
				>
					{#if option.kind === 'search'}
						<span class="lead"><Icon name="search" /></span>
						<span class="main">{m.search_for({ q: q.trim() })}</span>
					{:else if option.kind === 'person'}
						<Avatar
							name={option.user.name}
							seed={option.user.id}
							image={option.user.image}
							size={40}
						/>
						<span class="main">
							<b>{option.user.name}</b>
							<span class="sub">@{option.user.handle}</span>
						</span>
					{:else}
						<span class="lead"><Icon name="hash" /></span>
						<span class="main">
							<b>#{option.tag.tag}</b>
							<span class="sub"
								>{option.tag.posts === 1
									? m.profile_post({ count: option.tag.posts })
									: m.profile_posts({ count: option.tag.posts })}</span
							>
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</form>

<style>
	.search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		height: 42px;
		padding: 0 16px;
		border-radius: 999px;
		background: var(--bg-3);
		border: 1px solid transparent;
		color: var(--text-2);
	}
	.search:focus-within {
		background: var(--bg);
		border-color: var(--accent);
		color: var(--accent);
	}
	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
		font: inherit;
	}
	input::placeholder {
		color: var(--text-3);
	}
	.list {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 30;
		margin: 0;
		padding: 6px 0;
		list-style: none;
		max-height: min(420px, 70vh);
		overflow-y: auto;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 16px;
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
		color: var(--text);
	}
	li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		cursor: pointer;
	}
	li.active {
		background: var(--bg-2);
	}
	.lead {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		color: var(--text-2);
	}
	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.3;
	}
	.main b,
	.main .sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		color: var(--text-2);
		font-size: 14px;
	}
</style>
