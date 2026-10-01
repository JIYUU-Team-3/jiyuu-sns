# Moderation and bot detection plan

The plan for issues #29 (content moderation) and #30 (bot and spam detection). It says what is
not allowed, how it is caught, what moderators can do about it, and the order to build it in.
Nothing here is built yet. Drafted 2026-10-01; the team decides the open questions before Phase 1.

## Principles

1. **People decide, machines sort.** Automatic checks raise priority, blur, or hide pending review.
   Only the cheap, certain rules (duplicate spam, a blocklisted domain, a known-bad image) refuse a
   post outright. Nothing is permanently removed without a moderator.
2. **Cheap checks first.** Rate limits and rules run on every write and need no AI. AI runs after
   them, on what is left, within a daily budget. If AI is down or out of budget, posting still
   works and the content is marked unchecked.
3. **Check on write, never on read.** Results are stored, so reading a timeline costs nothing extra.
4. **Private stays private.** Direct messages are not read by any check. Only link hostnames and
   behaviour (who messages how many strangers) are looked at, and a message's text reaches a
   moderator only when someone in that chat reports it.
5. **English only, for now.** The AI text check runs on English posts. Japanese and Khmer posts skip
   it and rely on everything else (rules, image checks, links, behaviour, reports).
6. **No phone verification.** Google sign-in, trust levels and new-account limits cover it.

## What is not allowed

These categories are the report reasons, the moderator's action reasons, and the basis of a
community guidelines page (`/guidelines`).

### Never allowed — removed, account suspended

| Category                      | Examples                                                      | Caught by                                |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Sexual content with minors    | Any sexualised image or text involving under-18s              | Llama Guard S4, image check, hash list   |
| Credible threats              | Threats against a person, a school or a group                 | Llama Guard S1, reports                  |
| Terrorism, mass violence      | Recruiting for or glorifying attacks                          | Llama Guard S1/S9, reports               |
| Non-consensual intimate media | Leaked or "revenge" images, sexual deepfakes of real people   | Reports, image check, hash list          |
| Doxxing                       | Someone else's address, phone, ID or student number, location | Llama Guard S7, number patterns, reports |
| Encouraging self-harm         | Telling someone to hurt or kill themselves                    | Llama Guard S11, reports                 |

### Not allowed — removed, strikes lead to suspension

| Category                | Examples                                                                            | Caught by                                  |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| Hate speech             | Attacks or slurs on ethnicity, nationality, religion, gender, sexuality, disability | Llama Guard S10, reports                   |
| Harassment, bullying    | Targeting one person repeatedly, piling on in replies or mentions                   | Reports, behaviour signals, blocking (#21) |
| Impersonation           | Copying a classmate's or teacher's name and photo                                   | Reports, name similarity check             |
| Spam                    | Duplicate posts, mass mentions, follow churn, ads                                   | Write-time rules, behaviour score          |
| Scams and phishing      | Fake giveaways, "send money", fake login pages                                      | Llama Guard S2, link checks                |
| Malicious links         | Malware, phishing, lookalike domains                                                | Link checks (below)                        |
| Illegal goods           | Drugs, weapons, stolen accounts, exam answers for sale                              | Llama Guard S2, reports                    |
| Explicit sexual content | Pornography                                                                         | Image check, Llama Guard S12               |
| Graphic gore            | Real severe injury or death posted to shock                                         | Image check, reports                       |
| Copyright               | Reposting someone's paid work in full                                               | Reports only                               |

### Allowed behind a sensitive-media warning

Artistic or educational nudity, newsworthy violence, medical images, horror art. The author can
mark it, and so can a moderator or the image check.

### Allowed

Talking about one's own mental health (shown with a help-resources box rather than removed),
political opinions and criticism of the school or teachers, and swearing not aimed at a person.

### Strikes (proposal)

A removal in "not allowed" is a strike. One strike is a warning, three within 90 days a 7-day
suspension, five a permanent one. Anything in "never allowed" is an immediate suspension. A
successful appeal removes the strike.

## Trust levels

One number decides how strict limits are and how much gets checked. Computed on write and by the
hourly job, stored on the account.

| Level        | Rule (starting values, kept in KV)                                 |
| ------------ | ------------------------------------------------------------------ |
| `new`        | Account under 3 days old, or fewer than 3 posts that passed checks |
| `normal`     | Everyone else                                                      |
| `trusted`    | 30+ days, 20+ posts, no upheld report or action in 90 days         |
| `restricted` | Set by a moderator, or a behaviour score over the threshold        |

`new` and `restricted` accounts can't post links or video, post at most 10 times an hour, follow at
most 20 accounts an hour, and can only start a direct chat with someone who follows them. All their
images are checked; `normal` accounts' images are sampled; `trusted` accounts' only on report.

## When content is checked

| Event                            | Before saving (blocks)                                                      | After the response (`waitUntil`)                                                          |
| -------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Post created or edited           | Rate limits, spam rules, text cleaning, link checks, GIF rating, image hash | Llama Guard (English), image check by trust                                               |
| Profile name, bio, photo, banner | Text cleaning, link checks, image hash                                      | Llama Guard on bio, image check always                                                    |
| Direct message sent              | Rate limits, new-account chat rule, link checks (hostname only)             | —                                                                                         |
| Report filed                     | Report rate limit                                                           | Llama Guard / image check to set priority                                                 |
| Hourly (Cron Trigger)            | —                                                                           | Retry unchecked items, re-check recent link domains, recompute behaviour scores and trust |
| Reading anything                 | Never checked; stored results are applied                                   | —                                                                                         |

New accounts' posts publish immediately and are hidden if flagged, rather than held until checked.

## Write-time rules (no AI)

Refused before the post is saved:

- The same text as one of the author's own posts in the last 24 hours.
- More than 5 links or the existing mention cap.
- Bidi overrides and stacked combining marks ("Zalgo") — the cleaning names and bios already get,
  applied to post text too (`SECURITY.md` gap 9).
- A GIF the `pg-13` rating would hide: look the GIF up by id on the server instead of trusting
  the URL (`SECURITY.md` gap 10).
- An image whose SHA-256 (of the stripped bytes) is on the removed-media list.
- Any link the link checks refuse.

## Malicious links

What already exists: only `http(s)` is linkified, URLs with user info stay plain text, links carry
`rel="noopener nofollow ugc"`, and the server never fetches a pasted URL (no previews, so no SSRF).
Keep it that way.

1. **Shape checks (no network).** Parse each link with `new URL()`. Refuse mixed-script punycode
   hostnames (homographs such as a Cyrillic `а` in `pаypal`), bare IP addresses, non-default ports,
   and links to executables (`.exe .apk .scr .bat .msi .js .zip`) from `new` accounts. Link
   shorteners are refused for `new` accounts and add to the spam score otherwise; we never follow
   them, since that is a server fetch of a typed URL.
2. **Our blocklist.** A `blocked_domain` table, cached in KV. Moderators add to it from the queue.
   Matches the domain and its subdomains.
3. **Reputation lookup.** Cloudflare's security resolver over DNS-over-HTTPS
   (`security.cloudflare-dns.com`, the `1.1.1.2` service) answers `0.0.0.0` for known malware and
   phishing domains. Free, no key, sends only the hostname to the company that already hosts us.
   Results cached per hostname in KV for 24 hours; at most 5 lookups per post, 1-second timeout,
   own rate limit. On failure, the post is saved with `links_checked = false` and retried hourly.
   Google Safe Browsing is the second layer if this misses too much (needs a key and a privacy-page
   line, since it sees full URLs).
4. **Re-check.** Domains go bad after they are posted. The hourly job re-checks domains seen in the
   last 7 days. A newly bad domain goes on the blocklist, and `text_segments` renders blocklisted
   links as plain text everywhere, so old posts stop linking to it at once. Each affected post
   opens a case.
5. **On click.** Links from `new` and `restricted` accounts go through `/out?post=…&n=…`, which
   shows the real hostname before continuing. It takes a post id and link index, never a URL, so it
   can't become an open redirect. Add `noreferrer` to outbound links in `PostText.svelte`.

Direct messages render through the same `PostText`, so blocklisted links are disabled there too.

## AI checks

### Workers AI budget

The free allocation is 10,000 neurons a day. On the Workers Free plan, going over returns error
`4006` until the next day (no charge); on Workers Paid it is billed per neuron. Either way the app
keeps its own daily counter in KV and stops calling AI before the allocation runs out, so a spammer
can't burn the budget and then post unchecked: they hit rate limits and the rules first, and
anything not AI-checked stays `unchecked` for the hourly retry and for reports.

Starting split (to be tuned once real costs are measured in Phase 0): text 6,000, images 3,000,
reports 1,000. `new` accounts can use at most half of each.

### Text — `@cf/meta/llama-guard-3-8b`

Built for this: it answers `safe` or `unsafe` with a category (S1–S14), and output tokens are
almost free. Roughly 300–500 input tokens per post, which is about 500 checks a day in the free
allocation. It does not cover spam; the rules and behaviour score do. Run only when the text is
mostly Latin script (count Hiragana, Katakana, CJK and Khmer code points; no AI needed).

| Result                           | Action                                              |
| -------------------------------- | --------------------------------------------------- |
| `safe`                           | Nothing                                             |
| `unsafe` S4 (child exploitation) | `limited` at once, highest-priority case            |
| `unsafe` S1, S9, S10, S11, S12   | `limited` for `new`/`restricted`, case for everyone |
| any other `unsafe`               | Case only                                           |

### Images

Workers AI has no dedicated nudity classifier, so use a vision model
(`@cf/meta/llama-3.2-11b-vision-instruct`, or `mistral-small-3.1-24b-instruct`) with a fixed
prompt that must answer `{"nudity":0-3,"violence":0-3,"gore":0-3}` and `max_tokens` around 20.
Llama 3.2 Vision needs a one-time license-agreement call before first use.

- Checked when the post is published, not at upload (many uploads are discarded).
- All images from `new`/`restricted` accounts, every profile photo and banner, a sample from
  `normal`, `trusted` only on report.
- Score 2 marks the image sensitive; score 3 makes the post `limited` and opens a case.
- Removed images go on the hash list, so the same file can't be uploaded again.
- GIFs: server-side rating, no AI. Videos: no frame extraction in a Worker, so `new` accounts can't
  post video and other videos are reviewed on report.

### Testing the model before relying on it

Phase 0 builds an English test set of about 60 posts and 30 images (half harmful, half fine) and
records Llama Guard's and the vision model's hits and misses and the neurons each call uses. If the
results are poor, thresholds move toward "case only" before launch.

## Bot and spam detection (#30)

- **Behaviour score**, recomputed hourly: posts per hour, share of duplicate or near-duplicate
  posts, links per post, follows and unfollows per hour, direct chats started with non-followers,
  reports received (from distinct reporters), and actions against the account. Over the threshold,
  the account becomes `restricted` and a case opens; it never suspends on its own.
- **New-account limits** from the trust table.
- **Cloudflare Turnstile** on the onboarding form, if the team wants it after seeing the score in
  use. Needs `challenges.cloudflare.com` in the CSP `script-src` and `frame-src` and a privacy-page
  line.
- **No phone verification.**

## Moderation tools

### Roles and suspension

Use Better Auth's `admin` plugin (`role`, `banned`, `banReason`, `banExpires` on `user`; banned
accounts can't sign in). Check it works with `better-auth/minimal` first; otherwise add the same
columns ourselves and check them in `hooks.server.ts`. A `moderator()` guard in `session.ts` sits
beside `member()`. The first moderators are set by a script run against the local or production
database on purpose, since there is no admin UI before this.

A suspended account can sign in and read, but every write and every `member()` call returns 403
with the reason and end date, and its profile shows "suspended". Its posts stay visible unless
removed one by one. (Open question 4.)

### Visibility states on posts

`post.moderation`: `visible`, `sensitive`, `limited` (out of feeds, search, trending and reply
lists; its own link still works for the author and moderators), `removed` (soft-deleted: hidden
from everyone but the author, who sees why and can appeal). An author's own delete stays a hard
delete.

Every place that lists posts must apply it: `select_posts` in `server/posts.ts`, `search_posts`,
`search_tags`, `trending_tags`, `who_to_follow`, notifications, and `/media/[...key]`, which must
refuse a removed post's media to anyone but its author and moderators.

### Reports

Report button on posts (`PostMenu.svelte`), profiles, and messages. A reason from the categories
above and an optional note. One report per person per target. A message report includes that one
message, after checking the reporter is in the conversation. Reporting is also part of #21; this
plan assumes #29 owns the table and queue and #21 the button and blocking (open question 2).

### The queue (`/mod`)

One case per target, holding all its reports and automatic flags, ordered by severity, report
count and the author's trust. Flagged media is blurred in the queue too. Actions: dismiss, mark
sensitive, limit, remove, remove and strike, suspend, block domain, add image to hash list. Every
action writes a `moderation_action` row in the same batch, with the reason.

### Appeals

The author gets a `moderation` notification naming the rule and the action. One appeal per action,
answered in the same queue; a different moderator decides it when there is one. Upheld appeals
restore the post and remove the strike.

## Schema

New tables (a migration in `drizzle/`, via `pnpm db:generate`; never `db:push` to production):

- `report` — id, reporter_id, target_kind (`post`/`profile`/`message`), target_id, reason,
  note, created_at. Unique (reporter_id, target_kind, target_id).
- `moderation_case` — id, target_kind, target_id (unique together), status (`open`/`actioned`/
  `dismissed`), priority, source (`report`/`auto`), flags (JSON of automatic results),
  assigned_to, created_at, closed_at.
- `moderation_action` — id, case_id, moderator_id, action, reason, target_kind, target_id,
  expires_at, created_at, reversed_at. Append-only.
- `appeal` — id, action_id (unique), user_id, body, status, decided_by, decided_at, created_at.
- `blocked_domain` — domain, added_by, reason, created_at.
- `blocked_media_hash` — sha256, added_by, created_at.
- `account_standing` — user_id, trust, behaviour_score, strikes, updated_at.

New columns: `post.moderation`, `post.checked` (`pending`/`checked`/`unchecked`),
`post_media.sensitive`, `profile.moderation`, `notification.type` gains `moderation`, plus the
admin-plugin columns on `user`.

## Infrastructure

- `ai` binding in `wrangler.jsonc`. Unit tests and e2e run without it, as `under_limit` already does
  for rate limiters; a fake answer can be injected for tests. `wrangler dev` with the binding calls
  the real service and uses the allocation, so local dev leaves it off by default.
- Rate limiters: `REPORT_LIMIT` (10/min), `MOD_LIMIT` (120/min), `LINK_LOOKUP_LIMIT`.
- Cron Trigger for the hourly job. The SvelteKit Cloudflare adapter only exports `fetch`, so the
  job is either a small second Worker bound to the same D1 and KV (preferred: no new HTTP endpoint)
  or a custom entry that wraps the adapter's output. Decide in Phase 4.
- KV keys for thresholds, budgets and a switch that turns all AI calls off.

## Security rules that apply (from `CLAUDE.md`)

- Every moderator function starts with `moderator()`; every report with `await member()` and
  `limit('REPORT_LIMIT', …)`.
- Writes scoped in `where`; moderator actions scoped by role, not by loading and comparing.
- Moderator views return picked fields. No email addresses, ever.
- Outbound calls (DoH, Workers AI) capped per request and rate-limited.
- The `/out` page takes ids, not URLs.
- Each protection ships with a test in `security.e2e.ts` that fails without it.

## Phases

Each phase is one pull request with its tests. Phase 3 can come before Phase 1 if spam shows up
first: it needs no roles or AI.

### Phase 0 — decisions and measurements (no code)

Team answers the open questions. Build the English test set; measure neurons per text and image
call. Confirm the Workers plan.

### Phase 1 — roles, reports, queue, guidelines

Admin plugin and `moderator()`, suspension in `member()`, the moderator script, `report`,
`moderation_case`, `moderation_action`, report button, `/mod` queue with dismiss/remove/suspend,
`/guidelines` page (English text copied into `ja.json` and `km.json` until translated).
Tests: a member can't reach `/mod` or its remote functions; a suspended account can't write; a
member can't report a message from a chat they're not in; a report can't be repeated.

### Phase 2 — visibility, sensitive media, appeals

`post.moderation` applied in every query listed above and in `/media`; sensitive toggle in the
composer and a viewer setting; blurred `MediaItem`; `moderation` notifications; appeals.
Tests: a removed post is absent from feed, search, tags, profile, replies and notifications, and its
media returns 404 to others; a limited post is absent from feeds but opens for its author.

### Phase 3 — write-time rules, links, trust

Spam rules, text cleaning for posts, server-side GIF rating, image hash list, link shape checks,
blocklist, DoH lookup with cache, `noreferrer`, `/out`, trust levels and new-account limits.
Tests: each rule refuses; a blocklisted domain renders as plain text in an old post; `/out` refuses
anything not in a post; a `new` account can't post a link or start a chat with a stranger.

### Phase 4 — AI checks and the hourly job

`ai` binding, budget counter, Llama Guard on English text, vision check on images by trust, retry of
`unchecked` items, link re-check, the Cron Worker.
Tests: unit tests with a fake AI answer for each threshold; the budget stops calls; with AI off,
posting still works and items stay `unchecked`.

### Phase 5 — behaviour score (#30)

Score, `restricted` level, cases from the score, optional Turnstile.
Tests: a scripted burst of duplicate posts and follows makes an account `restricted` and opens a
case.

## Open questions for the team

1. Who moderates — the team, teachers, or both — and who runs the script that appoints them?
2. Reporting is in #21 too. Proposal: #29 owns the `report` table and queue, #21 owns the button,
   blocking and muting. Agree with #21's assignee before Phase 1.
3. Are any users under 18? This plan bans explicit sexual content either way.
4. Suspended accounts: read-only as proposed, or signed out entirely? And do their posts stay up?
5. How long do `removed` posts and their media stay before being deleted for real (proposal: 90
   days, or the end of an open appeal)?
6. Link hostnames in direct messages are checked under this plan. Agree, and say so on the privacy
   page.
7. Is the Cloudflare account on Workers Free or Paid?
8. Which help-line links go in the self-harm resources box?
9. Strike thresholds as proposed?

## Not in this plan

Phone verification, AI checks of Japanese or Khmer text, reading direct-message text, video frame
analysis, link previews, and an automated appeals decision.
