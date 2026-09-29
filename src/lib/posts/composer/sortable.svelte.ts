import { tick } from 'svelte'

type Point = { x: number; y: number }

/**
 * Drag-to-reorder for a small grid, with mouse, pen or touch. The dragged tile follows the
 * pointer; crossing another tile moves it into that spot, and the grid reflows around it.
 */
export class Sortable {
	/** The key of the tile being dragged. */
	dragging = $state<string>()
	/** How far the dragged tile sits from its spot in the grid, as a CSS `translate`. */
	offset = $state<Point>({ x: 0, y: 0 })

	/** Where in the tile the pointer grabbed it. */
	#grab: Point = { x: 0, y: 0 }

	constructor(
		private keys: () => string[],
		private move: (from: number, to: number) => void,
	) {}

	start(event: PointerEvent, key: string) {
		if (event.button !== 0 || (event.target as Element).closest('button')) return
		const tile = event.currentTarget as HTMLElement
		const at = this.#pointer(tile, event)
		this.#grab = { x: at.x - tile.offsetLeft, y: at.y - tile.offsetTop }
		this.dragging = key
		tile.setPointerCapture(event.pointerId)
	}

	async drag(event: PointerEvent) {
		if (!this.dragging) return
		const tile = event.currentTarget as HTMLElement
		const target = this.#tile_under(tile, event)
		const keys = this.keys()
		if (target) this.move(keys.indexOf(this.dragging), keys.indexOf(target))
		// After a move the tile's spot changed, so measure it again before placing it.
		await tick()
		this.#place(tile, event)
	}

	end() {
		this.dragging = undefined
		this.offset = { x: 0, y: 0 }
	}

	/** Arrow keys move the focused tile one spot, for keyboards and screen readers. */
	async key(event: KeyboardEvent, index: number) {
		const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
		if (!step) return
		event.preventDefault()
		const tile = event.currentTarget as HTMLElement
		this.move(index, index + step)
		await tick()
		tile.focus()
	}

	/*
	 * Positions come from layout offsets, not bounding rects: rects include the drag's translate
	 * and scale and the neighbours' flip animation, which would make tiles swap back and forth.
	 */

	/** The pointer relative to the grid's padding box. */
	#pointer(tile: HTMLElement, event: PointerEvent): Point {
		const grid = (tile.offsetParent as HTMLElement | null)?.getBoundingClientRect()
		return { x: event.clientX - (grid?.left ?? 0), y: event.clientY - (grid?.top ?? 0) }
	}

	/** Keep the grabbed point under the pointer, relative to the tile's spot in the grid. */
	#place(tile: HTMLElement, event: PointerEvent) {
		const at = this.#pointer(tile, event)
		this.offset = {
			x: at.x - this.#grab.x - tile.offsetLeft,
			y: at.y - this.#grab.y - tile.offsetTop,
		}
	}

	/** The sibling tile under the pointer, if any. */
	#tile_under(tile: HTMLElement, event: PointerEvent) {
		const at = this.#pointer(tile, event)
		const siblings = [...(tile.parentElement?.children ?? [])] as HTMLElement[]
		const hit = siblings.find(
			(other) =>
				other !== tile &&
				at.x >= other.offsetLeft &&
				at.x <= other.offsetLeft + other.offsetWidth &&
				at.y >= other.offsetTop &&
				at.y <= other.offsetTop + other.offsetHeight,
		)
		return hit?.dataset.key
	}
}
