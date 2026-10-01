import type { Reroute } from '@sveltejs/kit/hooks'
import { deLocalizeUrl } from '#lib/paraglide/runtime'
import { define_chosen_strategy } from '#lib/settings/locale'

// Universal hooks load first on both server and client, before anything reads the locale.
define_chosen_strategy()

export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname
