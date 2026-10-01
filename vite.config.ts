import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import adapter from '@sveltejs/adapter-cloudflare'
import { sveltekit } from '@sveltejs/kit/vite'
import { variables } from './src/env.ts'

// SvelteKit validates every private env var from src/env.ts during the build's
// analyse step, but on Cloudflare the real values are Worker secrets that only
// exist at runtime. Placeholders let a build without a .env (Workers Builds, CI)
// succeed; the Worker still validates the real values when it starts. Unit tests
// get the same placeholders, since a server module that imports $app/env would
// otherwise fail to load in CI, where there is no .env.
if (process.argv.includes('build') || process.env.VITEST) {
	for (const name of Object.keys(variables)) process.env[name] ??= ''
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true },
			},
			// Both test projects below start their own Workers runtime. Sharing the
			// persisted .wrangler/state between them fails with SQLITE_BUSY, so
			// tests get throwaway in-memory bindings instead.
			adapter: adapter({ platformProxy: { persist: !process.env.VITEST } }),
			experimental: { remoteFunctions: true },
			// What a page may load and where it may send things. SvelteKit adds a nonce for its own
			// inline script. Inline styles are allowed because Svelte's `style:` directives are
			// inline styles; scripts are not.
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					// GIPHY's CDN for GIFs, Google's for account photos, GitHub's for the team page.
					'img-src': [
						'self',
						'data:',
						'blob:',
						'https://*.giphy.com',
						'https://*.googleusercontent.com',
						'https://github.com',
						'https://avatars.githubusercontent.com',
					],
					'media-src': ['self', 'blob:'],
					// The emoji picker loads its emoji list from jsDelivr.
					'connect-src': ['self', 'https://cdn.jsdelivr.net'],
					'font-src': ['self', 'data:'],
					'worker-src': ['self'],
					'manifest-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					// Signing in posts to our own action, which redirects to Google.
					'form-action': ['self', 'https://accounts.google.com'],
					'frame-ancestors': ['none'],
				},
			},
		}),

		// The `paraglide` script in package.json compiles the same output for
		// `pnpm check`, which never runs Vite. Keep its flags in sync with these.
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// The picked language wins over a link's; see define_chosen_strategy in src/lib/settings/locale.ts.
			strategy: ['custom-chosen', 'url', 'baseLocale'],
		}),
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
						// Vitest's default, 63315, sits in the range Windows hands out in blocks to
						// Hyper-V, WSL and Docker at boot; a reserved port refuses to open and the
						// whole run fails. Windows never reserves ports this low.
						api: 5183,
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
})
