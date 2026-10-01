import { push } from '#lib/notifications/push.svelte'

export async function sign_out(event: SubmitEvent) {
	const form = event.currentTarget as HTMLFormElement
	event.preventDefault()
	await Promise.race([push.forget().catch(() => {}), new Promise((done) => setTimeout(done, 2000))])
	form.submit()
}
