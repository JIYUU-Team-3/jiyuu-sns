# Moderation and bot detection

Issues #29 (content moderation) and #30 (bot and spam detection): what is not allowed, how it is
caught, what moderators can do about it, and how it was built. Drafted and built 2026-10-01; all
five phases are in. Reports and blocking are #21's.

## Status

Built as planned, with these differences, each for a reason found while building:

- **Workers AI is reached over its REST API**, not a binding: under `wrangler dev --local`, which
  the e2e server runs, a binding wants a Cloudflare login. Two optional secrets turn the checks on
  (`WORKERS_AI_ACCOUNT_ID`, `WORKERS_AI_TOKEN`); deleting the token switches them off without a
  deploy, in place of a KV switch.
- **The hourly job is a Cron Trigger on the app's own Worker.** The Cloudflare adapter has no hook
  for a `scheduled` handler, so `scripts/wrap-worker.js` adds one after `vite build`. It calls
  `/internal/hourly` in-process with a token made fresh for each run.
- **Sensitive is a flag, not a fourth visibility state**, since a post can be both limited and
  sensitive. Profiles have no visibility state: a profile is dealt with by suspending the account.
- **The suspension review form uses `WRITE_LIMIT`**: Cloudflare rate limits count per minute at
  most, so "3 an hour" isn't expressible. One request per suspension is the real limit.
- **Bios aren't checked for links**, because bios aren't drawn as links.
- **The "leaving Jiyuu" page covers accounts under a month old**, since new accounts (under three
  days) can share links in only 5 posts or messages a day.
- **Images over 1 MB aren't sent to the vision model as they are**: encoding one costs CPU the
  Free plan doesn't have. The `IMAGES` binding makes a small JPEG of a larger one just for the
  check (5,000 a month on the Free plan, then it refuses and the image is left to reports).
- **Photos are checked while the post is written**, not only after: the composer asks
  `/media/check` once an upload finishes, warns the author when the photo is sensitive, and
  publishing marks the post either way. The answer is kept in `media_check`, so the check after
  publishing doesn't ask again.
- **Turnstile isn't added.** The plan made it optional, after seeing the score in use.

### Turning it on in production

1. Merge: the deploy runs the migrations (`0008` to `0012`) and deploys the Cron Trigger.
2. `pnpm db:grant-moderator jiyuu_org --remote` makes `@jiyuu_org` the moderator.
3. Optional, for the automatic checks: create a token with Workers AI Read and Edit, run
   `pnpm ai:measure` with it (see Phase 0), adjust `DAILY_NEURONS` in
   `server/moderation/budget.ts` if the costs differ, then
   `wrangler secret put WORKERS_AI_ACCOUNT_ID` and `wrangler secret put WORKERS_AI_TOKEN`.
4. #21 calls `on_report(db, report)` after saving each report.

## Decided

- **The moderator is the `@jiyuu_org` account**, on production and in local development alike. See
  [Moderator](#moderator).
- **Reporting belongs to #21.** It builds the `report` table and the report buttons; this plan
  reads reports and builds the queue on top. See [Reports](#reports).
- **A suspended account sees only a suspension page**: why, until when, and how to ask for the
  suspension to be lifted. See [Suspension](#suspension).
- **The Cloudflare account is on the Workers Free plan.** Nothing can be billed, but the free
  limits shape the design. See [Free plan limits](#free-plan-limits).
- **AI text checks are English only**, and **there is no phone verification**.
- **`@jiyuu_org` already exists on production**, so reserving the handle takes nothing from anyone.
- **No users are under 18.** Explicit sexual content stays banned anyway: this is a classroom
  network.
- **Link hostnames in direct messages are checked** against the blocklist and the reputation
  lookup; the message text is not.
- **Self-harm support (a help box, special handling) is out of scope.** Telling someone else to
  hurt themselves is still harassment and removed.
- **Strikes as proposed** below.
- **Removed posts are kept for 1 day**, then deleted for real with their media, unless an appeal
  is open. See [Appeals](#appeals).

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

Talking about one's own mental health (no special handling: self-harm support is out of scope),
political opinions and criticism of the school or teachers, and swearing not aimed at a person.

### Strikes

A removal in "not allowed" is a strike. One strike is a warning, three within 90 days a 7-day
suspension, five a permanent one. Anything in "never allowed" is an immediate suspension. A
successful appeal removes the strike.

## Trust levels

One number decides how strict limits are and how much gets checked. Computed on write and by the
hourly job, stored on the account.

| Level        | Rule (starting values, constants in code)                          |
| ------------ | ------------------------------------------------------------------ |
| `new`        | Account under 3 days old, or fewer than 3 posts that passed checks |
| `normal`     | Everyone else                                                      |
| `trusted`    | 30+ days, 20+ posts, no upheld report or action in 90 days         |
| `restricted` | Set by a moderator, or a behaviour score over the threshold        |

`new` accounts can share links in 5 posts, edits or messages a day and post 5 videos a day (UTC
days, counted in `new_account_allowance`; deleting a post gives none back). `restricted` accounts
can't post links or video at all. Both post at most 10 times an hour, follow at most 20 accounts an
hour, and can only start a direct chat with someone who follows them. All their
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
2. **Our blocklist.** A `blocked_domain` table in D1. Moderators add to it from the queue.
   Matches the domain and its subdomains.
3. **Reputation lookup.** Cloudflare's security resolver over DNS-over-HTTPS
   (`security.cloudflare-dns.com`, the `1.1.1.2` service) answers `0.0.0.0` for known malware and
   phishing domains. Free, no key, sends only the hostname to the company that already hosts us.
   Results cached per hostname for 24 hours in the Workers Cache API (free, no KV writes); at most 5 lookups per post, 1-second timeout,
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

Direct messages get the same link checks when they are sent, on the hostname only; the message
text is never read. They render through the same `PostText`, so blocklisted links are disabled
there too. The privacy page says so in one sentence (Phase 3).

## AI checks

### Workers AI budget

The free allocation is 10,000 neurons a day. We are on the Workers Free plan, so going over
returns error `4006` until 00:00 UTC and nothing is ever billed. The app keeps its own daily counter
(one D1 row per day, not KV: see [Free plan limits](#free-plan-limits)) and stops calling AI before
the allocation runs out, and treats a `4006` the same way, so a spammer
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
| `unsafe` S1, S9, S10, S12        | `limited` for `new`/`restricted`, case for everyone |
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
- **Ranking.** "For you" (`src/lib/server/ranking.ts`) reads the same signals: a post loses places
  for each post its author made in the six hours before it, for the author's behaviour score, and
  for reports on its open case. Likes from `new` or `restricted` accounts, and an author's own
  likes and replies, don't count toward it. A `restricted` account's posts reach only its
  followers there. "Following" stays in time order.

## Moderation tools

### Moderator

One account moderates: `@jiyuu_org`. Rights are tied to its **user id**, not to the handle,
because handles can be changed and re-used (`SECURITY.md` gap 7): a check on the handle would hand
moderation to whoever registers `jiyuu_org` after it is freed, or to anyone who creates it first on
a fresh local database.

- `account_standing.role` is `member` or `moderator`. `moderator()` in `session.ts`, beside
  `member()`, requires it; every `/mod` page, remote function and action starts there.
- `pnpm db:grant-moderator jiyuu_org --local | --remote` looks the handle up and sets the role on
  that user id. Same shape as `scripts/backfill-tags.ts`: it refuses to run without saying which
  database. Run once on production; locally, after signing in with the account you want to use.
- `jiyuu_org` goes into `RESERVED_HANDLES` in `src/lib/profiles/form/profile.ts`, so nobody else
  can take it. The account that already holds it keeps it.
- A moderator can't change their handle, so `@jiyuu_org` never comes free.
- e2e: a test helper grants the role to a fixed test account, so the `/mod` tests run against
  the local build without the real account.

More moderators later need no code change: run the script for another handle.
`pnpm db:revoke-moderator <handle> --local | --remote` takes the role away again.

### Suspension

Suspension is stored on `account_standing` (`suspended_until`, `suspend_reason`, and the action
that set it), not on Better Auth's generated `user` table. `hooks.server.ts` reads that row with
the session, by primary key, and sets `locals.suspended`.

A suspended account:

- is redirected from every `(app)` page to `/suspended`;
- gets 403 from `signed_in()` and `member()`, so no remote function reads or writes for it;
- gets 401 from `/media` and every `+server.ts` route;
- can still sign out.

`/suspended` shows the rule that was broken, the date the suspension ends (or "permanent"), and two
ways to ask for it to be lifted:

1. A **review request form**: one request per suspension, up to 1,000 characters, rate-limited.
   It is stored as an `appeal` on the suspension and appears in the `/mod` queue.
2. The contact address **jiyuu.org@gmail.com**, for when the form isn't enough.

The account's posts stay up unless removed one by one; its profile shows "This account is
suspended" instead of its posts while the suspension lasts. When `suspended_until` passes, access
returns on the next request; no job is needed.

### Visibility states on posts

`post.moderation`: `visible`, `sensitive`, `limited` (out of feeds, search, trending and reply
lists; its own link still works for the author and moderators), `removed` (soft-deleted: hidden
from everyone but the author, who sees why and can appeal). An author's own delete stays a hard
delete.

Every place that lists posts must apply it: `select_posts` in `server/posts.ts`, `search_posts`,
`search_tags`, `trending_tags`, `who_to_follow`, notifications, and `/media/[...key]`, which must
refuse a removed post's media to anyone but its author and moderators.

### Reports

**Owned by #21.** That issue builds the `report` table, the report buttons on posts
(`PostMenu.svelte`), profiles and messages, and the rate limit on reporting. This plan only reads
the table. What the queue needs from it, to agree with #21's assignee before either side starts:

- columns: `id`, `reporter_id`, `target_kind` (`post`/`profile`/`message`), `target_id`,
  `reason`, `note`, `created_at`, with one report per (reporter, target);
- `reason` values taken from the categories in [What is not allowed](#what-is-not-allowed), so a
  report and a moderator's action name the same rule;
- a message report checks that the reporter is in the conversation, and the queue sees only the
  reported message;
- a single function, `on_report(db, report)`, that #21 calls after inserting; this plan implements
  it to open or update the case. Until #29 lands it does nothing.

The queue can be built and tested before #21 lands, with automatic flags as its only input.

### The queue (`/mod`)

One case per target, holding all its reports and automatic flags, ordered by severity, report
count and the author's trust. Flagged media is blurred in the queue too. Actions: dismiss, mark
sensitive, limit, remove, remove and strike, suspend, block domain, add image to hash list. Every
action writes a `moderation_action` row in the same batch, with the reason.

### Appeals

The author gets a `moderation` notification naming the rule and the action. A post has one such
notification at a time: each new action replaces the last. One appeal per action, answered in the
same queue; a different moderator decides it when there is one. Upheld appeals restore the post
and remove the strike. Either decision is told to the author: a restore as any restore is, a
refusal as its own notification, since the post and its earlier notification are deleted with it.

While a request is open, its author sees where it stands (`ReviewStatus.svelte`) on the post or
on `/suspended`: sent, with a moderator, and the two ways it can be decided.

A removed post can be appealed for **1 day**. The hourly job deletes removed posts (and their R2
media) once that day has passed with no appeal, or once an appeal on them is refused. While an
appeal is open, the post is kept. The `moderation_action` row stays after the post is gone: it records
who removed what, under which rule and when, but not the post's text or media, so a deleted post is
really gone. Strikes keep counting from those rows.

## Schema

New tables (a migration in `drizzle/`, via `pnpm db:generate`; never `db:push` to production):

- `moderation_case` — id, target_kind, target_id (unique together), status (`open`/`actioned`/
  `dismissed`), priority, source (`report`/`auto`), flags (JSON of automatic results),
  assigned_to, created_at, closed_at.
- `moderation_action` — id, case_id, moderator_id, action, reason, target_kind, target_id,
  expires_at, created_at, reversed_at. Append-only.
- `appeal` — id, action_id (unique), user_id, body, status, decided_by, decided_at, created_at.
  Also holds suspension review requests.
- `account_standing` — user_id (primary key), role (`member`/`moderator`), trust,
  behaviour_score, strikes, suspended_until, suspend_reason, suspend_action_id, updated_at. Only
  accounts with something to record get a row; no row means a `member` in good standing.
- `blocked_domain` — domain, added_by, reason, created_at.
- `blocked_media_hash` — sha256, added_by, created_at.
- `ai_usage` — day, neurons. One row per day, the budget counter.
- `new_account_allowance` — user_id, day, links, videos. What a `new` account used of its daily
  allowance.

`report` comes from #21 (see [Reports](#reports)).

New columns: `post.moderation`, `post.checked` (`pending`/`checked`/`unchecked`),
`post_media.sensitive`, `profile.moderation`, and `notification.type` gains `moderation`. Nothing
is added to Better Auth's generated tables.

## Infrastructure

### Free plan limits

The account is on Workers Free. The limits that matter here, all reset at 00:00 UTC:

| Limit                   | Free plan                             | What the plan does about it                                                                                               |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Workers AI              | 10,000 neurons/day, then error `4006` | Own budget counter; stop early; `unchecked` + hourly retry                                                                |
| KV writes               | 1,000/day                             | **No KV writes** on any per-post path. Counters and blocklists in D1, link verdicts in the Cache API                      |
| KV reads                | 100,000/day                           | Only the AI switch is read                                                                                                |
| D1 rows written         | 100,000/day                           | A check writes 1–3 rows; fine at our size                                                                                 |
| D1 rows read            | 5 million/day                         | The standing lookup per request is one row by primary key                                                                 |
| CPU time per request    | 10 ms                                 | AI calls and lookups are waiting, not CPU. Hashing uses `crypto.subtle`. Heavy work goes in `waitUntil` or the hourly job |
| Subrequests per request | 50                                    | At most 5 link lookups + 2 AI calls per post                                                                              |
| Cron Triggers           | 5 per account                         | The plan needs one                                                                                                        |
| Requests                | 100,000/day                           | The second Worker's hourly run is 24 a day                                                                                |

If the app outgrows these, Workers Paid lifts them; nothing in the plan has to change, only the
budget numbers.

### Bindings and jobs

- `ai` binding in `wrangler.jsonc`. Unit tests and e2e run without it, as `under_limit` already does
  for rate limiters; a fake answer can be injected for tests. `wrangler dev` with the binding calls
  the real service and spends the shared daily allocation, so local dev leaves it off by default.
- Rate limiters: `REPORT_LIMIT` (#21), `MOD_LIMIT` (120/min), `APPEAL_LIMIT` (3/hour),
  `LINK_LOOKUP_LIMIT`.
- Cron Trigger for the hourly job. The SvelteKit Cloudflare adapter only exports `fetch`, so the
  job is either a small second Worker bound to the same D1 (preferred: no new HTTP endpoint)
  or a custom entry that wraps the adapter's output. Decide in Phase 4.
- One KV key, read only, that turns all AI calls off without a deploy. Thresholds are constants in
  code.

## Security rules that apply (from `CLAUDE.md`)

- Every moderator function starts with `moderator()`. Moderator rights come from the user id in
  `account_standing`, never from a handle.
- Suspension is checked in `signed_in()` and `member()`, so no remote function forgets it, and in
  every `+server.ts` route and page `load` through `locals.suspended`.
- Writes scoped in `where`; moderator actions scoped by role, not by loading and comparing.
- Moderator views return picked fields. No email addresses, ever.
- Outbound calls (DoH, Workers AI) capped per request and rate-limited.
- The `/out` page takes ids, not URLs.
- Each protection ships with a test in `security.e2e.ts` that fails without it.

## Phases

Each phase is one pull request with its tests. Phase 3 can come before Phase 1 if spam shows up
first: it needs no roles or AI.

### Phase 0 — agreements and measurements (no code)

Agree the `report` shape and `on_report` with #21's assignee. Answer the open questions below.
Build the English test set; measure neurons per text and image call, and set the budget split from
the measurements.

### Phase 1 — moderator, suspension, queue, guidelines

`account_standing`, `moderator()`, `pnpm db:grant-moderator`, `jiyuu_org` reserved and its handle
locked, suspension in `hooks.server.ts`, `signed_in()` and `member()`, the `/suspended` page with
its review request form and contact address, `moderation_case`, `moderation_action`, `appeal`,
`on_report`, the `/mod` queue with dismiss/remove/suspend, and the `/guidelines` page (English text
copied into `ja.json` and `km.json` until translated).

Tests:

- a member can't open `/mod` or call any of its remote functions;
- the role follows the user id: renaming `@jiyuu_org` keeps it, and a new account can't register
  `jiyuu_org`;
- a suspended account gets `/suspended` from every page and 403 from remote functions, `/media`
  and `+server.ts` routes, and regains access when the suspension ends;
- a suspended account can send one review request, not two;
- the review request shows up in the queue.

### Phase 2 — visibility, sensitive media, appeals

`post.moderation` applied in every query listed above and in `/media`; sensitive toggle in the
composer and a viewer setting; blurred `MediaItem`; `moderation` notifications; appeals on post
actions.

Tests: a removed post is absent from feed, search, tags, profile, replies and notifications, and its
media returns 404 to others; a limited post is absent from feeds but opens for its author.

### Phase 3 — write-time rules, links, trust

Spam rules, text cleaning for posts, server-side GIF rating, image hash list, link shape checks,
blocklist, DoH lookup with Cache API, the same link checks on direct messages and a privacy-page
sentence about them, `noreferrer`, `/out`, trust levels and new-account limits.

Tests: each rule refuses; a blocklisted domain renders as plain text in an old post; `/out` refuses
anything not in a post; a `new` account can't post a link or start a chat with a stranger.

### Phase 4 — AI checks and the hourly job

`ai` binding, the `ai_usage` budget, Llama Guard on English text, vision check on images by trust,
retry of `unchecked` items, link re-check, the Cron Worker.

Tests: unit tests with a fake AI answer for each threshold; the budget stops calls; a `4006` is
treated as out of budget; with AI off, posting still works and items stay `unchecked`.

### Phase 5 — behaviour score (#30)

Score, `restricted` level, cases from the score, optional Turnstile.

Tests: a scripted burst of duplicate posts and follows makes an account `restricted` and opens a
case.

## Open questions for the team

None. Everything above is decided; Phase 0 can start.

## Not in this plan

Phone verification, AI checks of Japanese or Khmer text, reading direct-message text, video frame
analysis, link previews, an automated appeals decision, self-harm support, and the report table
and buttons (#21).
