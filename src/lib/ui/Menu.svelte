<script lang="ts" module>
	export type TriggerProps = {
		onclick: () => void
		'aria-haspopup': 'menu'
		'aria-expanded': boolean
	}
</script>

<script lang="ts">
	import { tick, type Snippet } from 'svelte'

	let {
		label,
		placement = 'cover',
		class: klass = '',
		trigger,
		children,
	}: {
		label: string
		placement?: 'cover' | 'cover-start' | 'above'
		class?: string
		/** The button that opens the menu; spread the props onto it. */
		trigger: Snippet<[TriggerProps]>
		/** Menu items (`.menu-item` buttons with `role="menuitem"`); call `close` before acting. */
		children: Snippet<[close: () => void]>
	} = $props()

	let open = $state(false)
	let wrap: HTMLDivElement
	let menu = $state<HTMLDivElement>()

	const opener = () => wrap.firstElementChild as HTMLElement | null
	/** Shown items only, so arrow keys skip one a breakpoint hides. */
	const items = () =>
		[...(menu?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])].filter((item) =>
			item.checkVisibility(),
		)

	async function show() {
		open = true
		await tick()
		items()[0]?.focus()
	}

	function close(refocus = true) {
		open = false
		if (refocus) opener()?.focus()
	}

	function onkeydown(event: KeyboardEvent) {
		const list = items()
		const at = list.indexOf(document.activeElement as HTMLElement)
		const go = (i: number) => {
			event.preventDefault()
			list[(i + list.length) % list.length]?.focus()
		}
		if (event.key === 'ArrowDown') go(at + 1)
		else if (event.key === 'ArrowUp') go(at - 1)
		else if (event.key === 'Home') go(0)
		else if (event.key === 'End') go(list.length - 1)
		else if (event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			close()
		} else if (event.key === 'Tab') close(false)
	}

	$effect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => {
			if (!wrap.contains(event.target as Node)) close(false)
		}
		window.addEventListener('pointerdown', outside, true)
		return () => window.removeEventListener('pointerdown', outside, true)
	})
</script>

<div class="wrap {klass}" bind:this={wrap}>
	{@render trigger({
		onclick: () => (open ? close() : show()),
		'aria-haspopup': 'menu',
		'aria-expanded': open,
	})}
	{#if open}
		<div
			class="pop {placement}"
			role="menu"
			aria-label={label}
			tabindex="-1"
			bind:this={menu}
			{onkeydown}
		>
			{@render children(() => close())}
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	.pop {
		position: absolute;
		z-index: 30;
		min-width: 240px;
		max-width: 320px;
		background: var(--bg-elev);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-pop);
		border: 1px solid var(--line);
		padding: 6px 0;
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		animation: popin 0.16s var(--ease-out);
		cursor: default;
	}
	.cover {
		top: 0;
		right: 0;
		transform-origin: top right;
	}
	.cover-start {
		top: 0;
		left: 0;
		transform-origin: top left;
	}
	.above {
		bottom: calc(100% + 8px);
		left: 0;
		transform-origin: bottom left;
	}
	@keyframes popin {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	.pop :global(.menu-item) {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 11px 16px;
		font-weight: 600;
		font-size: 15px;
		text-align: left;
		white-space: nowrap;
		transition: background-color 0.12s;
	}
	.pop :global(.menu-item:hover),
	.pop :global(.menu-item:focus-visible) {
		background: var(--bg-2);
		outline: none;
	}
	.pop :global(.menu-item.danger) {
		color: var(--danger);
	}
	.pop :global(.menu-sep) {
		height: 1px;
		background: var(--line);
		margin: 6px 0;
	}
</style>
