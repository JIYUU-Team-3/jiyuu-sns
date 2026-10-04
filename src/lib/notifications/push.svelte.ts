import { VAPID_PUBLIC_KEY } from '$app/env/public'
import { delete_push_subscription, save_push_subscription } from './notifications.remote'

/**
 * - `unsupported`: this browser can't do push, or the deployment has no keys
 * - `install`: iPhone/iPad in a browser tab; push is only offered to a Home Screen app
 * - `update`: iPhone/iPad already opened from the Home Screen, but older than iOS 16.4
 * - `blocked`: the reader said no, and only the browser's site settings can undo that
 * - `unavailable`: the browser couldn't reach its push service, e.g. Brave with Google push
 *   messaging switched off (its default)
 */
export type PushState =
	'checking' | 'unsupported' | 'install' | 'update' | 'blocked' | 'unavailable' | 'off' | 'on'

function key_bytes(text: string) {
	const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
	return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export const is_ios = () =>
	/iPad|iPhone|iPod/.test(navigator.userAgent) ||
	(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Opened from the Home Screen as an app of its own, not in a browser tab. */
export const is_standalone = () =>
	matchMedia('(display-mode: standalone)').matches ||
	(navigator as Navigator & { standalone?: boolean }).standalone === true

/** Brave says so itself; its user agent reads as plain Chrome. */
const is_brave = () => 'brave' in navigator

/** Desktop Brave, whose push needs a setting switched on; Brave on Android has no such setting. */
export const is_brave_desktop = () => is_brave() && !/Android/i.test(navigator.userAgent)

/** A subscribe that never settles counts as failed, so the button doesn't spin forever. */
function within<T>(promise: Promise<T>, ms: number) {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Push subscription timed out.')), ms),
		),
	])
}

const supported = () =>
	!!VAPID_PUBLIC_KEY &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	'Notification' in window

async function registration() {
	return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.ready
}

async function current_subscription() {
	if (!supported()) return null
	return (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null
}

function save(subscription: PushSubscription) {
	const { endpoint, keys } = subscription.toJSON()
	if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Incomplete push subscription.')
	return save_push_subscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
}

class Push {
	state = $state<PushState>('checking')
	busy = $state(false)

	async check() {
		if (!supported()) {
			this.state = !is_ios() ? 'unsupported' : is_standalone() ? 'update' : 'install'
			return
		}
		const subscription = await current_subscription()
		if (subscription) {
			this.state = 'on'
			// Keeps the server in step if this browser was turned on under another account.
			save(subscription).catch(() => {})
		} else {
			this.state = Notification.permission === 'denied' ? 'blocked' : 'off'
		}
	}

	async enable() {
		if (this.busy || !VAPID_PUBLIC_KEY) return
		this.busy = true
		try {
			const permission = await Notification.requestPermission()
			if (permission !== 'granted') {
				this.state = permission === 'denied' ? 'blocked' : 'off'
				return
			}
			const push_manager = (await registration()).pushManager
			const options = { userVisibleOnly: true, applicationServerKey: key_bytes(VAPID_PUBLIC_KEY) }
			let subscription: PushSubscription
			try {
				subscription = await within(this.#subscribe(push_manager, options), 20_000)
			} catch (error) {
				console.warn('Push subscription failed', error)
				this.state = 'unavailable'
				return
			}
			await save(subscription)
			this.state = 'on'
		} finally {
			this.busy = false
		}
	}

	async #subscribe(push_manager: PushManager, options: PushSubscriptionOptionsInit) {
		try {
			return await push_manager.subscribe(options)
		} catch (error) {
			// Subscribed earlier with keys that have since changed: start over.
			const stale = await push_manager.getSubscription()
			if (!stale) throw error
			await stale.unsubscribe()
			return push_manager.subscribe(options)
		}
	}

	async disable() {
		if (this.busy) return
		this.busy = true
		try {
			await this.forget()
			this.state = 'off'
		} finally {
			this.busy = false
		}
	}

	/** Stop pushes to this browser, e.g. before signing out, so the next person doesn't get them. */
	async forget() {
		const subscription = await current_subscription()
		if (!subscription) return
		await delete_push_subscription(subscription.endpoint)
		await subscription.unsubscribe()
	}
}

export const push = new Push()
