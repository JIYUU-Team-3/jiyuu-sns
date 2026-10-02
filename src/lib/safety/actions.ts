import { m } from '#lib/paraglide/messages.js'
import { hidden_authors } from '#lib/posts/state.svelte'
import { toast } from '#lib/ui/toasts.svelte'
import { set_block, set_mute } from './safety.remote'

type Person = { id: string; handle: string }

async function toggle(
	person: Person,
	on: boolean,
	save: typeof set_block,
	done: (args: { handle: string }) => string,
	hide: boolean,
) {
	if (on && hide) hidden_authors.add(person.id)
	else hidden_authors.delete(person.id)
	try {
		await save({ handle: person.handle, on })
		toast.show(done({ handle: person.handle }))
	} catch {
		hidden_authors.delete(person.id)
		toast.show(m.toast_error())
	}
}

export const mute = (person: Person, on: boolean, hide = true) =>
	toggle(person, on, set_mute, on ? m.toast_muted : m.toast_unmuted, hide)

export const block = (person: Person, on: boolean, hide = true) =>
	toggle(person, on, set_block, on ? m.toast_blocked : m.toast_unblocked, hide)
