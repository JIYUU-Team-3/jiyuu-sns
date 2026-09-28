<!--
@component
A count that rolls when it changes: digits that change slide out one way and in from the other,
fading and blurring like `TextMorph`, while the width eases to fit. A rising `value` brings new
digits up from below; a falling one brings them down from above. `text` is `value` as shown.
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
		type Spot,
	} from './morph'
	import { diff_places, split_graphemes } from './text-diff'

	let { value, text }: { value: number; text: string } = $props()

	type Unit = { key: number; text: string }
	type Ghost = Unit & Spot
	/** A roll measured before the DOM changed, played once it has; `dir` is 1 up, -1 down. */
	type Staged = { width: number; fresh: boolean[]; dir: number }

	/** How far a digit travels as it rolls in or out. */
	const RISE = '0.6em'

	let next_key = 0
	let units = $state<Unit[]>(untrack(() => to_units(text)))
	let ghosts = $state<Ghost[]>([])
	let outer: HTMLElement
	let inner: HTMLElement
	let letters: HTMLElement
	let shown = untrack(() => ({ value, text }))
	let staged: Staged | null = null

	$effect.pre(() => {
		const next = { value, text }
		if (next.text === shown.text) return
		const dir = next.value < shown.value ? -1 : 1
		shown = next
		untrack(() => stage(next.text, dir))
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

	/** Measure the old layout, then swap in the new digits and the ghosts of the changed ones. */
	function stage(next: string, dir: number) {
		const quiet = still()
		const width = outer.getBoundingClientRect().width
		const old_spots = spots(inner, letters.children)
		outer.getAnimations({ subtree: true }).forEach((a) => a.cancel())

		const old = units
		const diff = diff_places(
			old.map((u) => u.text),
			split_graphemes(next),
		)
		units = diff.units.map(({ text, from }) =>
			from === null ? { key: next_key++, text } : old[from],
		)
		ghosts = quiet ? [] : diff.removed.map((i) => ({ ...old[i], ...old_spots[i] }))
		const fresh = diff.units.map(({ from }) => from === null)
		staged = quiet ? null : { width, fresh, dir }
	}

	function animate({ width, fresh, dir }: Staged) {
		ease_width(outer, width)
		roll_in(fresh, dir)
		roll_out(dir)
	}

	/** New digits rise into place from the side the count moved away from. */
	function roll_in(fresh: boolean[], dir: number) {
		const from = dir > 0 ? RISE : `-${RISE}`
		Array.from(letters.children).forEach((el, i) => {
			if (!fresh[i]) return
			el.animate({ top: [from, '0px'] }, MOVE)
			el.animate({ opacity: [0, 1], filter: [BLUR, 'blur(0)'] }, FADE_IN)
		})
	}

	/** Old digits leave the way the count moved, fading as they go. */
	function roll_out(dir: number) {
		const shown_ghosts = ghosts
		const to = dir > 0 ? `-${RISE}` : RISE
		const done = Array.from(inner.querySelectorAll<HTMLElement>('.ghost'), (el, i) => {
			align(inner, el, shown_ghosts[i])
			el.animate(
				{ transform: ['translateY(0)', `translateY(${to})`] },
				{ ...MOVE, fill: 'forwards' },
			)
			return el.animate({ opacity: [1, 0], filter: ['blur(0)', BLUR] }, FADE_OUT).finished
		})
		Promise.all(done).then(
			() => {
				if (ghosts === shown_ghosts) ghosts = []
			},
			() => {},
		)
	}
</script>

<span class="roll" bind:this={outer}>
	<span class="inner" bind:this={inner}>
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
	/* The digits hug the right edge, so a width change grows or shrinks the left side only. */
	.roll {
		display: inline-flex;
		justify-content: flex-end;
		white-space: pre;
	}
	.inner {
		position: relative;
		display: inline-block;
	}
	/* Relative, not transformed: inline boxes can't take a transform. */
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
