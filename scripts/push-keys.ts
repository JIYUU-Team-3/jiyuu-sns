/**
 * Print a fresh VAPID key pair for push notifications. Put the lines in `.env` for local dev;
 * for production, store each as a Worker secret (`wrangler secret put VAPID_PRIVATE_KEY`).
 * Changing the keys later unsubscribes every browser, so generate them once per environment.
 */
import { generate_vapid_keys } from '../src/lib/server/web-push.ts'

const keys = await generate_vapid_keys()
console.log(`VAPID_PUBLIC_KEY="${keys.public_key}"`)
console.log(`VAPID_PRIVATE_KEY="${keys.private_key}"`)
console.log('VAPID_SUBJECT="mailto:jiyuu.org@gmail.com"')
