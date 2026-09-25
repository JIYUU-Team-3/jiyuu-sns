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
})
