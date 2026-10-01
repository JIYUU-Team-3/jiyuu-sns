import { reduced_motion } from './motion'

export const FADE_MS = 450

let timer: ReturnType<typeof setTimeout> | undefined

export function fade(change: () => void, kind: 'theme' | 'clear' = 'theme') {
	if (reduced_motion() || document.hidden) return change()
	const root = document.documentElement
	root.dataset.themeFade = kind
	change()
	clearTimeout(timer)
	timer = setTimeout(() => delete root.dataset.themeFade, FADE_MS)
}
