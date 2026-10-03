import { avatar_hue, initials } from '#lib/ui/avatar'

/** Someone a push notification is from: their photo, or their initials on their colour. */
export type Face = { name: string; seed: string; image?: string }

/** The icon's size in pixels; Android and Windows show it at up to 96 CSS pixels. */
const SIZE = 192
/** The app's logo in the bottom-right corner, as messaging apps badge a sender's photo. */
const LOGO = { d: 76, ring: 8 }
/** A group's two photos, placed as `ConversationAvatar` places them (30 of 44, with a 2px gap). */
const PAIR = { d: Math.round((SIZE * 30) / 44), ring: Math.round((SIZE * 2) / 44) }

const GOOGLE_PHOTO = /^https:\/\/lh\d\.googleusercontent\.com\//

/**
 * Where to load a face's photo from: only the app's own `/media/` uploads or Google's photo host,
 * the same two the server shows, so a push can never make the browser fetch anything else.
 */
export function face_source(image: string | undefined, origin: string) {
	if (!image) return undefined
	if (GOOGLE_PHOTO.test(image)) return { url: image, own: false }
	if (!image.startsWith('/media/')) return undefined
	// Checked again once resolved, so `/media/../` can't climb out.
	const url = new URL(image, origin)
	const own = url.origin === origin && url.pathname.startsWith('/media/')
	return own ? { url: url.href, own } : undefined
}

/** The image at `url`, or undefined when it doesn't load in time or isn't an image. */
async function load(url: string, own: boolean, fetcher: typeof fetch) {
	try {
		const response = await fetcher(url, {
			// Uploads need the sign-in cookie; Google's host refuses requests carrying a referrer.
			credentials: own ? 'same-origin' : 'omit',
			mode: own ? 'same-origin' : 'cors',
			referrerPolicy: 'no-referrer',
			signal: AbortSignal.timeout(4000),
		})
		if (!response.ok) return undefined
		return await createImageBitmap(await response.blob())
	} catch {
		return undefined
	}
}

type Ctx = OffscreenCanvasRenderingContext2D

/** Clear a ring around a circle, so what's drawn next stands apart on any background. */
function cut(ctx: Ctx, x: number, y: number, d: number, ring: number) {
	ctx.save()
	ctx.globalCompositeOperation = 'destination-out'
	ctx.beginPath()
	ctx.arc(x + d / 2, y + d / 2, d / 2 + ring, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()
}

function circle(ctx: Ctx, x: number, y: number, d: number, paint: () => void) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2)
	ctx.clip()
	paint()
	ctx.restore()
}

function draw_face(
	ctx: Ctx,
	face: Face,
	photo: ImageBitmap | undefined,
	x: number,
	y: number,
	d: number,
) {
	circle(ctx, x, y, d, () => {
		if (photo) {
			// Cover, as `object-fit: cover` does in the app.
			const scale = Math.max(d / photo.width, d / photo.height)
			const w = photo.width * scale
			const h = photo.height * scale
			ctx.drawImage(photo, x + (d - w) / 2, y + (d - h) / 2, w, h)
			return
		}
		// The light theme's avatar colours from `app.css`.
		const hue = avatar_hue(face.seed)
		ctx.fillStyle = `hsl(${hue} 55% 88%)`
		ctx.fillRect(x, y, d, d)
		ctx.fillStyle = `hsl(${hue} 45% 28%)`
		ctx.font = `700 ${Math.round(d * 0.38)}px system-ui, sans-serif`
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(initials(face.name), x + d / 2, y + d / 2)
	})
}

async function to_data_url(blob: Blob) {
	const bytes = new Uint8Array(await blob.arrayBuffer())
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return `data:${blob.type};base64,${btoa(binary)}`
}

/**
 * The notification's icon: the sender's photo, or two members' for a group, with the app's logo
 * in the corner. Undefined where the browser can't draw off screen, so the plain logo is used.
 */
export async function draw_push_icon(
	faces: Face[],
	{ origin, logo, fetcher = fetch }: { origin: string; logo: string; fetcher?: typeof fetch },
) {
	const shown = faces.slice(0, 2)
	if (!shown.length || typeof OffscreenCanvas === 'undefined') return undefined
	const canvas = new OffscreenCanvas(SIZE, SIZE)
	const ctx = canvas.getContext('2d')
	if (!ctx) return undefined

	const [photos, logo_image] = await Promise.all([
		Promise.all(
			shown.map((face) => {
				const source = face_source(face.image, origin)
				return source ? load(source.url, source.own, fetcher) : undefined
			}),
		),
		load(new URL(logo, origin).href, true, fetcher),
	])

	if (shown.length === 1) {
		draw_face(ctx, shown[0], photos[0], 0, 0, SIZE)
	} else {
		const far = SIZE - PAIR.d
		draw_face(ctx, shown[0], photos[0], 0, 0, PAIR.d)
		cut(ctx, far, far, PAIR.d, PAIR.ring)
		draw_face(ctx, shown[1], photos[1], far, far, PAIR.d)
	}
	if (logo_image) {
		const at = SIZE - LOGO.d
		cut(ctx, at, at, LOGO.d, LOGO.ring)
		circle(ctx, at, at, LOGO.d, () => ctx.drawImage(logo_image, at, at, LOGO.d, LOGO.d))
	}
	for (const photo of [...photos, logo_image]) photo?.close()

	return to_data_url(await canvas.convertToBlob({ type: 'image/png' }))
}
