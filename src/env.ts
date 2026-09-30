import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.',
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).',
	},
	GOOGLE_CLIENT_ID: {
		description:
			'Google OAuth client ID. See [Better Auth Google provider](https://www.better-auth.com/docs/authentication/google).',
	},
	GOOGLE_CLIENT_SECRET: {
		description:
			'Google OAuth client secret. See [Better Auth Google provider](https://www.better-auth.com/docs/authentication/google).',
	},
	VAPID_PUBLIC_KEY: {
		public: true,
		description:
			'Push notification (VAPID) public key, base64url. Generate a pair with `pnpm push:keys`; leave empty to turn push off.',
		schema: (value) => value || undefined,
	},
	VAPID_PRIVATE_KEY: {
		description: 'Push notification (VAPID) private key, base64url, from `pnpm push:keys`.',
		schema: (value) => value || undefined,
	},
	VAPID_SUBJECT: {
		description:
			'A contact push services can reach about this app, e.g. `mailto:jiyuu.org@gmail.com`.',
		schema: (value) => value || undefined,
	},
	GIPHY_API_KEY: {
		description:
			'GIPHY API key for the composer’s GIF picker. Optional: without it the picker says GIFs are unavailable. See [GIPHY developers](https://developers.giphy.com/).',
		schema: (value) => value || undefined,
	},
})
