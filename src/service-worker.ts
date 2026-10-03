/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/*
 * Only push notifications for now: no offline caching, so every page still comes fresh from
 * the server exactly as it would without a service worker.
 */

import { acknowledge, deliver } from '#lib/messages/delivery'
import { draw_push_icon, type Face } from '#lib/notifications/push-icon'
import { logo_colours } from '#lib/notifications/push-theme'
import { DEFAULT_PREFS, parse_prefs, PREFS_COOKIE } from '#lib/settings/prefs'

const sw = self as unknown as ServiceWorkerGlobalScope

const DELIVERED_SYNC = 'delivered'

type SyncEvent = ExtendableEvent & { tag: string }
type SyncRegistration = ServiceWorkerRegistration & {
	sync?: { register(tag: string): Promise<void> }
}

const post_delivered = () => fetch('/messages/delivered', { method: 'POST' })

const delivered = () =>
	deliver({
		post: post_delivered,
		wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		later: async () => {
			await (sw.registration as SyncRegistration).sync?.register(DELIVERED_SYNC)
		},
	})

type PushMessage = {
	title: string
	body?: string
	url: string
	tag: string
	delivered?: boolean
	/** Who it's from, drawn as the icon with the app's logo in the corner; two for a group. */
	faces?: Face[]
}

const LOGO = '/icon-192.png'

/**
 * This device's display preferences, from the cookie the page keeps, so the icon's logo is in the
 * theme chosen here. Defaults where the browser has no cookie store in a service worker.
 */
async function device_prefs() {
	try {
		const store = (sw as { cookieStore?: { get(name: string): Promise<{ value: string } | null> } })
			.cookieStore
		const cookie = await store?.get(PREFS_COOKIE)
		return cookie ? parse_prefs(decodeURIComponent(cookie.value)) : DEFAULT_PREFS
	} catch {
		return DEFAULT_PREFS
	}
}

/** The sender's photo with the logo, or just the logo when it can't be drawn. */
async function icon_for(message: PushMessage) {
	if (!message.faces?.length) return LOGO
	try {
		const logo = logo_colours(await device_prefs())
		return (await draw_push_icon(message.faces, { origin: sw.location.origin, logo })) ?? LOGO
	} catch {
		return LOGO
	}
}

sw.addEventListener('install', (event) => {
	event.waitUntil(sw.skipWaiting())
})

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim())
})

sw.addEventListener('push', (event) => {
	let message: PushMessage
	try {
		message = event.data?.json() as PushMessage
	} catch {
		return
	}
	if (!message?.title) return

	event.waitUntil(
		(async () => {
			const delivering = message.delivered ? delivered() : undefined
			const windows = await sw.clients.matchAll({ type: 'window' })
			const path = new URL(message.url, sw.location.origin).pathname
			const reading = windows.some(
				(client) => client.focused && new URL(client.url).pathname === path,
			)
			if (!reading)
				await sw.registration.showNotification(message.title, {
					body: message.body,
					tag: message.tag,
					// A like replacing an earlier one on the same post still alerts.
					renotify: true,
					icon: await icon_for(message),
					badge: '/badge-72.png',
					data: { url: message.url },
				} as NotificationOptions)
			// Open tabs update their unread badge now instead of at the next minute's check.
			for (const client of windows) {
				client.postMessage({ type: message.delivered ? 'message' : 'notification' })
			}
			await delivering
		})(),
	)
})

sw.addEventListener('sync', (event) => {
	const sync = event as SyncEvent
	if (sync.tag !== DELIVERED_SYNC) return
	sync.waitUntil(
		acknowledge(post_delivered).then((done) => {
			if (!done) throw new Error('Not delivered yet.')
		}),
	)
})

sw.addEventListener('notificationclick', (event) => {
	event.notification.close()
	// Whatever the message said, a click only ever opens a page of this site.
	const target = new URL(event.notification.data?.url ?? '/notifications', sw.location.origin)
	const url =
		target.origin === sw.location.origin ? target.href : `${sw.location.origin}/notifications`

	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
			const open = windows.find((client) => new URL(client.url).origin === sw.location.origin)
			// Reuse a Jiyuu tab when there is one. navigate() only works on tabs this worker
			// controls, so anything else gets a new window.
			if (open) {
				try {
					const tab = await open.navigate(url)
					if (tab) return void (await tab.focus())
				} catch {
					// Fall through.
				}
			}
			await sw.clients.openWindow(url)
		})(),
	)
})
