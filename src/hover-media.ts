// Touch screens fake :hover on a tap and leave it stuck until the next tap somewhere else, so a
// card or row stays highlighted after you scroll past it. This PostCSS plugin moves every :hover
// selector, in app.css and in components, under `@media (hover: hover)`, so only a real pointer
// sees it, and repeats it as :active under `@media (hover: none)`, so a finger gets the same
// tint only while it is pressing. A selector list is split: `.row:hover, .row.on` keeps `.row.on`
// for everyone. Write :hover rules as usual; this rewrites them at build time.

const POINTER = '(hover: hover)'
const TOUCH = '(hover: none)'

/** The slice of PostCSS's API this plugin touches; postcss itself only comes in through Vite. */
interface Node {
	type: string
	parent?: Node
	params?: string
}
interface Rule extends Node {
	selectors: string[]
	clone(overrides: { selectors: string[] }): Rule
	after(node: Node): void
	remove(): void
}
interface AtRule extends Node {
	append(node: Node): void
}
interface Helpers {
	// eslint-disable-next-line @typescript-eslint/naming-convention -- PostCSS's name
	AtRule: new (props: { name: string; params: string }) => AtRule
}

/** Already under a hover query, written by hand or by this plugin. */
function is_gated(node: Node): boolean {
	for (let at = node.parent; at; at = at.parent) {
		if (at.type === 'atrule' && /hover:\s*(hover|none)/.test(at.params ?? '')) return true
	}
	return false
}

/** A :hover inside :not() means "not hovered", which should still hold on touch. */
function hovers(selector: string): boolean {
	return selector.includes(':hover') && !/:not\([^)]*:hover/.test(selector)
}

function wrap(rule: Rule, params: string, selectors: string[], postcss: Helpers): AtRule {
	const media = new postcss.AtRule({ name: 'media', params })
	media.append(rule.clone({ selectors }))
	return media
}

function gate(rule: Rule, postcss: Helpers) {
	if (is_gated(rule)) return
	const hover = rule.selectors.filter(hovers)
	if (hover.length === 0) return
	const press = hover.map((selector) => selector.replaceAll(':hover', ':active'))
	const pointer = wrap(rule, POINTER, hover, postcss)
	const touch = wrap(rule, TOUCH, press, postcss)
	// The copies go right after the original, so later rules still override them in order.
	rule.after(touch)
	rule.after(pointer)
	const rest = rule.selectors.filter((selector) => !hovers(selector))
	if (rest.length === 0) rule.remove()
	else rule.selectors = rest
}

export function hover_media() {
	// eslint-disable-next-line @typescript-eslint/naming-convention -- PostCSS's visitor name
	return { postcssPlugin: 'hover-media', Rule: gate }
}
