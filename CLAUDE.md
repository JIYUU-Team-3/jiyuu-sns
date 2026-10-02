# Jiyuu SNS

SvelteKit 3 (pre-release, remote functions) on a Cloudflare Worker, with D1 (Drizzle), R2 for
media, KV for caches, Better Auth with Google sign-in, and Paraglide for en/ja/km.

## Commands

- `pnpm run check` — typecheck (regenerates `worker-configuration.d.ts` first)
- `pnpm run lint` — Prettier check and ESLint (ESLint takes several minutes on the whole repo)
- `pnpm exec vitest --run` — unit tests
- `pnpm run build && pnpm exec playwright test --project=chromium` — e2e against a local build
- `pnpm db:push`, `db:migrate`, `db:studio` act on the **remote** database named in `.env`. Use
  `pnpm db:migrate:local` for the local one. Don't run the remote ones without being asked.

## Security rules

Jiyuu is for signed-in people only. Read `docs/SECURITY.md` before changing auth, remote
functions, uploads, media, push, or anything in `src/lib/server/`. In every change:

1. A layout guard protects pages, not data. Every remote function starts with `signed_in()`
   (reads) or `await member()` (writes) from `src/lib/server/session.ts`. Every form action,
   `+server.ts` handler and page `load` checks `locals.user` itself.
2. Scope writes to their owner in the `where` clause; never load a row and compare ids after.
3. Never use a URL a person typed as an image, video or link target without an allowlist
   (`is_own_post_upload`, `is_gif_url`, `account_image` / `shown_image`). A new host the browser
   must reach also goes in the CSP in `vite.config.ts`.
4. No `{@html}` with anything a person wrote. Post text goes through `text_segments`.
5. SQL goes through Drizzle or a `sql` template with `${}` parameters; `LIKE` patterns through
   `escape_like`.
6. Read request bodies with `read_form(request, max)`, never `request.formData()`.
7. Anything one request can multiply (notifications, pushes, outbound fetches, rows, page depth)
   gets a hard cap, and new endpoints that write or call a third party get `limit()` from
   `src/lib/server/rate-limit.ts`.
8. Metadata is stripped by keep-list (`strip-metadata.ts`, `strip-video.ts`); refuse what can't
   be parsed.
9. Return picked fields, never a whole `user` row. Email addresses go to their owner only.
10. Email and password sign-in exists only for e2e (`ALLOW_EMAIL_SIGNUP` in `.env.e2e`). Never
    enable it elsewhere, and never print or commit values from `.env` or `.env.prod`.
11. A security fix comes with a test that fails without it; see `src/routes/security.e2e.ts`.
12. Every query that lists posts includes `visible_posts(viewer)`; moderation tools start with
    `moderator()` or `require_moderator(locals)`. See `docs/MODERATION.md`.
