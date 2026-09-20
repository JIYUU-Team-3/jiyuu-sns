import prettier from 'eslint-config-prettier'
import path from 'node:path'
import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import { defineConfig, includeIgnoreFile } from 'eslint/config'
import globals from 'globals'
import ts from 'typescript-eslint'

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore')

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
			},
		},
	},
	{
		// Naming rules apply to hand-written app source only. Deliberately scoped
		// to `src`, which excludes:
		//   - build config at the root (vite/playwright/drizzle/eslint configs)
		//   - worker-configuration.d.ts and src/lib/paraglide, both generated
		//   - tests/, whose specs follow Playwright's own conventions
		// This also means the type-aware parser only needs tsconfig's `include`,
		// which already covers `src` — no allowDefaultProject workaround needed.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		languageOptions: {
			parserOptions: {
				// naming-convention requires type information.
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/naming-convention': [
				'error',
				// This project writes app code in snake_case. camelCase is also allowed
				// because generated code (src/lib/paraglide) and the drizzle schema use
				// it, and neither is ours to rename. What the rule still catches is
				// accidental PascalCase or SCREAMING_CASE on ordinary identifiers.
				{
					selector: 'default',
					format: ['snake_case', 'camelCase'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow',
				},
				// Module-level constants are conventionally SCREAMING_CASE, and
				// imported components are PascalCase.
				{
					selector: 'variable',
					format: ['snake_case', 'camelCase', 'UPPER_CASE', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{ selector: 'import', format: ['snake_case', 'camelCase', 'PascalCase'] },
				{ selector: 'typeLike', format: ['PascalCase'] },
				{ selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },

				// SvelteKit's +server.ts route handlers are exported under the HTTP
				// verb - `export function GET(...)`. The framework matches on that
				// name, so it is not ours to rename.
				{
					selector: 'function',
					modifiers: ['exported'],
					format: ['snake_case', 'camelCase', 'UPPER_CASE'],
				},

				// --- Exemptions: names we don't get to choose ---

				// Destructuring an external payload. `const { accessToken } = await
				// res.json()` shouldn't force a rename at the boundary.
				{ selector: 'variable', modifiers: ['destructured'], format: null },

				// Keys that cannot be written as bare identifiers - 'x-api-key',
				// 'Content-Type', 'some.dotted.key'.
				{
					selector: [
						'objectLiteralProperty',
						'typeProperty',
						'classProperty',
						'objectLiteralMethod',
					],
					format: null,
					modifiers: ['requiresQuotes'],
				},

				// Object shapes cross boundaries in both directions: our own snake_case
				// data, drizzle's camelCase columns, SvelteKit action names, and
				// env-shaped config. Let both styles through.
				{
					selector: ['objectLiteralProperty', 'objectLiteralMethod'],
					format: ['snake_case', 'camelCase', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
				},
				// Type surfaces follow whatever the values they describe use.
				{ selector: 'typeProperty', format: ['snake_case', 'camelCase'] },
			],
		},
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {},
	},
)
