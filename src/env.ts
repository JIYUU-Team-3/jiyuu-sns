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
	ALLOW_EMAIL_SIGNUP: {
		description:
			'Set to `1` only for the e2e server (`.env.e2e`): turns on email and password accounts, which the tests sign up with. Leave empty everywhere else; people sign in with Google.',
		schema: (value) => value || undefined,
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
	WORKERS_AI_ACCOUNT_ID: {
		description:
			'The Cloudflare account whose Workers AI runs the automatic moderation checks. Optional: with this or `WORKERS_AI_TOKEN` empty, the checks are off and posts are left to reports and moderators. See docs/MODERATION.md.',
		schema: (value) => value || undefined,
	},
	WORKERS_AI_TOKEN: {
		description:
			'An API token with Workers AI Read and Edit, for the automatic moderation checks. Optional; deleting the Worker secret turns the checks off without a deploy.',
		schema: (value) => value || undefined,
	},
	GIPHY_API_KEY: {
		description:
			'GIPHY API key for the composer’s GIF picker. Optional: without it the picker says GIFs are unavailable. See [GIPHY developers](https://developers.giphy.com/).',
		schema: (value) => value || undefined,
	},
})
