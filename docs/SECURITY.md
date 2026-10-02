# Security notes

For whoever works on Jiyuu next. It says what the app defends against, where each defence lives,
what is still open, and the rules that keep new code from reopening old holes. Last reviewed
2026-10-02.

## The model in one paragraph

Jiyuu is for signed-in people only. Nothing a member writes — posts, profiles, search results,
uploaded media — is meant to be readable without a session. People sign in with Google; there are
no passwords. The server is a Cloudflare Worker in front of D1 (data), R2 (media) and KV (cache).
Everything the browser sends is untrusted, including the arguments of remote functions and the
`width`, `height`, `kind` and URLs of attached media.

## Rules for new code

These are the ones that have already been broken once.

1. **A layout guard protects pages, not data.** Remote functions (`*.remote.ts`) and `+server.ts`
   routes are their own HTTP endpoints; the `(app)` layout redirect never runs for them. Every
   remote function starts with `signed_in()` (reads) or `await member()` (writes) from
   `src/lib/server/session.ts`. Every form action and `+server.ts` handler checks `locals.user`
   itself. A page `load` runs alongside its layout's, so it checks too.
2. **Writes go through `member()`.** It requires a finished profile and counts against the write
   rate limit. Don't hand-roll a session check for a command.
3. **Scope every change to its owner in the `where` clause** (`eq(post.authorId, user_id)`), as
   `update_post` and `remove_post` do. Never load a row and compare ids afterwards.
4. **Never show a URL the user typed as an image, video or link target** without an allowlist.
   Uploads must pass `is_own_post_upload`; GIFs `is_gif_url`; account photos `account_image` /
   `shown_image`. A new kind of media needs its own check _and_ a CSP entry in `vite.config.ts`.
5. **No `{@html}` with anything a person wrote.** Post text is rendered through `text_segments`,
   which only ever produces text, `http(s)` links, tags and handles. Keep it that way.
6. **SQL goes through Drizzle or a `sql` template with `${}` parameters.** Never build SQL with
   string concatenation in request code. `LIKE` patterns go through `escape_like`.
7. **Read request bodies with `read_form(request, max)`**, never `request.formData()`: the latter
   buffers a body of any size.
8. **Anything that fans out needs a cap**: mentions per post, subscriptions per account, offset
   depth, list sizes in valibot schemas. If one request can cause N writes, pushes or outbound
   fetches, N needs a hard number.
9. **New endpoints that write or call a third party get a rate limit** (`limit()` in
   `src/lib/server/rate-limit.ts`, bindings in `wrangler.jsonc`).
10. **Metadata is stripped by keep-list.** `strip-metadata.ts` and `strip-video.ts` keep only what
    draws the picture and refuse what they can't parse. A new format follows the same shape.
11. **Server-only data stays server-only.** Email addresses are returned to their owner and nobody
    else. Don't return a whole `user` row from a `load` or a query; pick the fields.
12. **A security fix comes with a test that fails without it.** See `src/routes/security.e2e.ts`.
13. **Every post query filters with `visible_posts(viewer)`** from `src/lib/server/safety.ts`, so
    blocks and private accounts hold. `page()`, `find_post` and `find_posts` already do; a new
    `select_posts` call outside them must add it. Timelines and search also add
    `unmuted_posts(viewer)`, and people lists add `visible_people(viewer)`.

## Where each defence lives

| Threat                                    | Defence                                                                                         | Where                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Reading posts/profiles without a session  | `signed_in()` on every query; redirects in page loads                                           | `session.ts`, `*.remote.ts`                   |
| Fake or squatted accounts                 | Google sign-in only; email accounts need a flag that only works on loopback                     | `auth.ts` (`email_signup`)                    |
| Posting without a profile                 | `member()`                                                                                      | `session.ts`, `routes/media/+server.ts`       |
| Cross-site requests                       | SvelteKit's origin check (forms and remote calls); SameSite session cookie                      | framework default — don't turn `csrf` off     |
| Script injection                          | No `{@html}` on user text; CSP with nonces, `script-src 'self'`                                 | `vite.config.ts`                              |
| Clickjacking                              | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                               | `vite.config.ts`, `hooks.server.ts`           |
| Tracking readers through media            | Avatar host allowlist, GIF host allowlist, CSP `img-src`, `no-referrer`                         | `account-image.ts`, `gifs.ts`                 |
| Hostile uploads                           | Type from the bytes, no SVG, metadata stripped, `nosniff`, size and rate caps                   | `media.ts`, `strip-*.ts`, `form.ts`           |
| Attaching someone else's upload           | `is_own_post_upload`                                                                            | `server/media.ts`                             |
| Server-side request forgery via push      | Push endpoints limited to known push services                                                   | `web-push.ts` (`is_push_endpoint`)            |
| Abuse and scraping                        | Rate limits; mention, subscription and offset caps; hourly push de-duplication                  | `rate-limit.ts`, `posts.ts`, `push.ts`        |
| Impersonation                             | Reserved handles; control and bidi characters stripped from names and bios                      | `profiles/form/profile.ts`                    |
| Misleading links                          | URLs with user info (`https://bank@evil/`) are not linkified                                    | `posts/text.ts`                               |
| Reading someone else's chat or its photos | Membership checked in every message query; message photos open only to members and the uploader | `server/messages.ts`, `routes/media/[...key]` |
| Harassment by a known account             | Block (both ways: posts, follows, replies, likes, notifications, direct chats), mute, report    | `server/safety.ts`, `server/follows.ts`       |
| Reading a private account's posts         | `visible_posts` in every post query; follows need the owner's approval                          | `server/safety.ts`, `server/posts.ts`         |
| Unwanted replies                          | The post's reply audience is checked on the server before a reply is written                    | `server/posts.ts` (`insert_thread`)           |
| Poisoned CI dependencies                  | Actions pinned to commits, safe-chain, `pnpm audit`, frozen lockfile                            | `.github/workflows/`                          |

## Known gaps, most important first

None of these is a hole you can walk through today, but each is where a determined person would
look next.

### Operations — do these outside the code

1. **Development and production share secrets.** The local `.env` holds the same
   `BETTER_AUTH_SECRET` and Google client secret as production, and its `CLOUDFLARE_DATABASE_ID`
   is the production database. So a leaked laptop `.env` is a production leak, and
   `pnpm db:push`, `db:migrate` or `db:studio` run from a laptop act on production data. Give
   development its own secret, its own Google OAuth client and its own D1 database, and rotate
   the production ones once that is done.
2. **Unused credentials.** `.env` still has `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, which the
   app no longer uses. Revoke that OAuth app.
3. **Old email accounts.** Accounts made through email sign-up before it was turned off still
   exist. One made with someone else's address blocks that person's Google sign-in ("account not
   linked"). Find them with
   `select u.id, u.email from user u join account a on a.user_id = u.id where a.provider_id = 'credential'`
   and remove the ones that aren't real.
4. **Branch protection.** A push to `development` deploys to production with the Cloudflare
   tokens. Require reviews on that branch, and required reviewers on the `production` environment.
5. **Scope the API tokens.** `CLOUDFLARE_D1_TOKEN` should only be able to edit this one database;
   `CLOUDFLARE_API_TOKEN` only to deploy this Worker.
6. **Logs hold what people search for.** Observability keeps request URLs, and remote-function
   URLs carry their arguments (search text among them). Treat the logs as personal data and keep
   retention short.

### Code — not done yet

1. **Blocks don't reach group chats.** A block stops direct chats both ways, but anyone can still
   put up to 49 people in a group without asking them, blocked or not, and a direct chat can't be
   left. Consider asking before adding someone to a group.
2. **No moderation or admin role.** Reports are stored in the `report` table, but nobody reviews
   them, and nobody can remove someone else's post or suspend an account except by editing the
   database.
3. **No account deletion or data export.** The schema cascades correctly from `user`, but nothing
   calls it, and R2 objects would be left behind.
4. **Uploads that are never attached stay in R2.** The composer deletes what it discards, but a
   scripted client need not. Needs a scheduled sweep of `posts/…` keys with no `post_media` row,
   and of `messages/…` keys with no `message` row. A group's photos are also left in R2 when its
   last member leaves and the conversation is deleted.
5. **Uploads pass through Worker memory.** A 50 MB video is buffered; a few at once approach the
   128 MB isolate limit. The durable fix is uploading straight to R2 (presigned URL or multipart)
   and stripping metadata afterwards.
6. **Rate limits are per Cloudflare location and approximate.** They stop a script, not a
   distributed attacker. Cloudflare WAF rules in front of `/api/auth/*`, `/media` and
   `/_app/remote/*` are the next layer.
7. **Handles can be re-used.** After a handle change the old one is free, and old `@mentions` and
   links point at whoever takes it. Needs a table of retired handles.
8. **Posts can be edited forever.** Likes and replies stay on a post whose text changed; only the
   "Edited" label says so. Polls are locked once voted on; ordinary posts are not. Consider an
   edit window or edit history.
9. **Post text keeps bidi and stacked combining characters.** Names and bios are cleaned; post
   bodies are not, so a post can still reorder its own text or stack marks ("Zalgo") to overflow
   its row. The length limit counts graphemes, so one "character" can be long.
10. **GIF rating is only applied in the picker.** `create_post` accepts any URL on GIPHY's CDN, so
    a scripted client can attach a GIF the `pg-13` filter would have hidden.
11. **The video length limit trusts the file's header.** `strip_video` reads the duration the file
    claims. The 50 MB cap is the real limit.
12. **Third parties see readers' addresses**: GIPHY (GIFs), Google (account photos), jsDelivr
    (emoji data), GitHub (team page photos). Proxying or self-hosting removes each. The emoji data
    is pinned to an exact version; self-hosting it would remove the dependency entirely.
13. **`style-src 'unsafe-inline'`** is allowed because Svelte's `style:` directives are inline
    styles. It only matters if HTML injection exists, which rule 5 prevents.
14. **Media is cached for a year in the browser** (`private, immutable`). On a shared computer it
    outlives the session, and deleted media stays in caches that already have it.
15. **Framework versions float.** `@sveltejs/kit` and the Cloudflare adapter are on the `next`
    tag (pre-release). The lockfile pins what is installed, but every lockfile update takes
    unreviewed pre-release code. Move to stable releases when Kit 3 ships, and consider pnpm's
    `minimumReleaseAge`.

## Before you ship a change, ask

- Can this be called without a session? Without a profile? (Try it with `curl`, not the UI.)
- Can I do this to someone else's post, profile, upload or subscription by changing an id?
- What is the largest input, the longest list, the deepest page? What does it cost?
- Does one request make the server write, push or fetch many times?
- Does any value a person typed end up in a URL the browser loads, or in HTML?
- Did I add a host the browser must reach? Then it is in the CSP, and in the privacy page.
- Is there a test that fails if this protection is removed?

## Checking it yourself

- `pnpm exec playwright test src/routes/security.e2e.ts` — signed-out reads, chats closed to outsiders, writes without a
  profile, avatar URLs, upload rate limit, blocked and private posts, reply limits, messaging a
  blocker.
- `pnpm audit` — runs in CI and before commits that touch dependencies.
- The server the tests run against has `ALLOW_EMAIL_SIGNUP=1` (`.env.e2e`). To see what production
  does, run `wrangler dev` without `.env.e2e`: `POST /api/auth/sign-up/email` answers 400.

## Reporting a problem

Tell the maintainers privately (jiyuu.org@gmail.com) rather than opening a public issue.
