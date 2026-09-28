<!--
@component
Text that morphs when it changes: letters shared with the old text slide to their new place,
letters that differ only in case cross-fade there, and the rest fade in or out, while the width
eases to fit. `reserve` holds texts to size for up front, so switching between them keeps the width.
-->
<script lang="ts">
	import { untrack } from 'svelte'
	import {
		align,
		BLUR,
		ease_width,
		FADE_IN,
		FADE_OUT,
		MOVE,
		spots,
		still,
		SWAP_OUT,
		type Spot,
	} from './morph'
	import { diff_text, split_graphemes } from './text-diff'

	let { text, reserve = [] }: { text: string; reserve?: string[] } = $props()

	type Unit = { key: number; text: string }
	type Ghost = Unit & { x: number; y: number }
	/** Where a new unit starts: from an old unit's spot, or nowhere; `fade` when its text is new. */
	type Plan = { spot: Spot | null; fade: boolean }
	/** A morph measured before the DOM changed, played once it has. */
	type Staged = { width: number; plans: Plan[]; targets: number[] }

	let next_key = 0
	let units = $state<Unit[]>(untrack(() => to_units(text)))
	let ghosts = $state<Ghost[]>([])
	// A copy of `reserve` the DOM renders, changed only by `stage`, after it has measured.
	let sizes = $state<string[]>(untrack(() => [...reserve]))
	let outer: HTMLElement
	let inner: HTMLElement
	let letters: HTMLElement
	let shown = untrack(() => [text, ...reserve].join('\n'))
	let staged: Staged | null = null

	$effect.pre(() => {
		const wanted = [text, ...reserve].join('\n')
		if (wanted === shown) return
		shown = wanted
		const next = text
		const next_sizes = [...reserve]
		untrack(() => stage(next, next_sizes))
	})

	// Runs after the DOM update, in the same frame, so nothing paints before the animations start.
	$effect(() => {
		void units
		const play = staged
		staged = null
		if (play) untrack(() => animate(play))
	})

	function to_units(value: string): Unit[] {
		return split_graphemes(value).map((t) => ({ key: next_key++, text: t }))
	}

	/** Measure the old layout, then swap in the new units and the ghosts of the old ones. */
	function stage(next: string, next_sizes: string[]) {
		const quiet = still()
		const width = outer.getBoundingClientRect().width
		const old_spots = spots(inner, letters.children)
		outer.getAnimations({ subtree: true }).forEach((a) => a.cancel())

		const old = units
		const diff = diff_text(
			old.map((u) => u.text),
			split_graphemes(next),
		)
		const plans: Plan[] = diff.units.map(({ text, from }) => ({
			spot: from === null ? null : old_spots[from],
			fade: from === null || old[from].text !== text,
		}))
		units = diff.units.map(({ text, from }) =>
			from === null || old[from].text !== text ? { key: next_key++, text } : old[from],
		)
		// Old units that leave, or whose letter is swapped for another case, fade out where they were.
		const leaving = [
			...diff.removed,
			...diff.units.flatMap(({ text, from }) =>
				from !== null && old[from].text !== text ? [from] : [],
			),
		]
		sizes = next_sizes
		ghosts = quiet ? [] : leaving.map((i) => ({ ...old[i], ...old_spots[i] }))
		const targets = leaving.map((i) => diff.units.findIndex((u) => u.from === i))
		staged = quiet ? null : { width, plans, targets }
	}

	/** Measure the new layout first: once letters start moving, they no longer sit where they end. */
	function animate({ width, plans, targets }: Staged) {
		const new_spots = spots(inner, letters.children)
		ease_width(outer, width)
		animate_units(plans, new_spots)
		animate_ghosts(targets, new_spots)
	}

	function animate_units(plans: Plan[], new_spots: Spot[]) {
		Array.from(letters.children).forEach((el, i) => {
			const { spot, fade } = plans[i]
			if (spot) {
				const dx = spot.x - new_spots[i].x
				const dy = spot.y - new_spots[i].y
				el.animate({ left: [`${dx}px`, '0px'], top: [`${dy}px`, '0px'] }, MOVE)
			}
			if (!fade) return
			if (spot) el.animate({ opacity: [0, 1] }, FADE_IN)
			else el.animate({ opacity: [0, 1], filter: [BLUR, 'blur(0)'] }, FADE_IN)
		})
	}

	/** Fade out the ghosts; a swapped letter's ghost also follows its replacement to the new spot. */
	function animate_ghosts(targets: number[], new_spots: Spot[]) {
		const shown_ghosts = ghosts
		const done: Promise<unknown>[] = []
		inner.querySelectorAll<HTMLElement>('.ghost').forEach((el, i) => {
			align(inner, el, shown_ghosts[i])
			const target = targets[i]
			if (target >= 0) {
				const dx = new_spots[target].x - shown_ghosts[i].x
				const dy = new_spots[target].y - shown_ghosts[i].y
				const { offsetLeft: x, offsetTop: y } = el
				el.animate(
					{ left: [`${x}px`, `${x + dx}px`], top: [`${y}px`, `${y + dy}px`] },
					{ ...MOVE, fill: 'forwards' },
				)
				done.push(el.animate({ opacity: [1, 0] }, SWAP_OUT).finished)
			} else {
				done.push(el.animate({ opacity: [1, 0], filter: ['blur(0)', BLUR] }, FADE_OUT).finished)
			}
		})
		Promise.all(done).then(
			() => {
				if (ghosts === shown_ghosts) ghosts = []
			},
			() => {},
		)
	}
</script>

<span class="morph" bind:this={outer}>
	<span class="inner" bind:this={inner}>
		{#each sizes as size, i (i)}
			<span class="size" aria-hidden="true">{size}</span>
		{/each}
		<span class="letters" bind:this={letters}>
			{#each units as unit (unit.key)}
				<span class="unit">{unit.text}</span>
			{/each}
		</span>
		{#each ghosts as ghost (ghost.key)}
			<!-- Placed by `align` once rendered. -->
			<span class="ghost" aria-hidden="true">{ghost.text}</span>
		{/each}
	</span>
</span>

<style>
	/* The text hugs the right edge, so a width change grows or shrinks the left side only. */
	.morph {
		display: inline-flex;
		justify-content: flex-end;
		white-space: pre;
	}
	.inner {
		position: relative;
		display: inline-grid;
		justify-items: center;
	}
	.size,
	.letters {
		grid-area: 1 / 1;
	}
	.size {
		visibility: hidden;
	}
	/* Relative, not transformed: inline boxes can't take a transform, and staying inline keeps
	   neighbouring letters shaped together. */
	.unit {
		position: relative;
	}
	.ghost {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}
</style>
