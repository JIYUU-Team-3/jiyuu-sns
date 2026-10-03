import { accent_hue } from '#lib/settings/accents'
import { accent_tokens } from '#lib/settings/daylight'
import { daylight_vars, local_minutes, type Prefs } from '#lib/settings/prefs'

/** `app.css`'s page background and brand blue, which are the same in both bands. */
const GROUND = { light: '#ffffff', dark: '#161618' }
const BLUE = '#1d9bf0'

/**
 * The logo in a push icon's corner, in the theme chosen on this device: its Y in the accent, on
 * the app's background. Under System there's no `ground`, so the notification's own shows through
 * and follows the device as the app does.
 */
export type LogoColours = { ground?: string; mark: string }

const accent = (prefs: Prefs, dark: boolean) => {
	const hue = accent_hue(prefs.accent)
	return hue === undefined ? BLUE : accent_tokens(hue, dark)['--accent']
}

export function logo_colours(prefs: Prefs, now = new Date()): LogoColours {
	switch (prefs.theme) {
		case 'light':
			return { ground: GROUND.light, mark: accent(prefs, false) }
		case 'dark':
			return { ground: GROUND.dark, mark: accent(prefs, true) }
		case 'daylight': {
			const vars = daylight_vars(local_minutes(now, now.getTimezoneOffset()), prefs.accent)
			return { ground: vars['--bg'], mark: vars['--accent'] }
		}
		default:
			return { mark: accent(prefs, false) }
	}
}
