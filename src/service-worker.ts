/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/*
 * Only push notifications for now: no offline caching, so every page still comes fresh from
 * the server exactly as it would without a service worker.
 */

const sw = self as unknown as ServiceWorkerGlobalScope

type PushMessage = { title: string; body?: string; url: string; tag: string }

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
			await sw.registration.showNotification(message.title, {
				body: message.body,
				tag: message.tag,
				// A like replacing an earlier one on the same post still alerts.
				renotify: true,
				icon: '/icon-192.png',
				badge: '/badge-72.png',
				data: { url: message.url },
			} as NotificationOptions)
			// Open tabs update their unread badge now instead of at the next minute's check.
			for (const client of await sw.clients.matchAll({ type: 'window' })) {
				client.postMessage({ type: 'notification' })
			}
		})(),
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
