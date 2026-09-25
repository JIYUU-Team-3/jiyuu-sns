# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience for now is the course instructor/graders evaluating a school homework project. The product is built as if it were a real public short-form social network; demo content can be anything, as long as it exercises every feature.

## Product Purpose

Jiyuu (自由, "freedom") is a short-form social network in the vein of X (Twitter) and Bluesky. Success for this phase: a complete, credible prototype that demonstrates every required feature clearly enough to grade, and that the team can port into the SvelteKit app.

## Positioning

A faithful, minimal take on the X/Bluesky model, built by students on SvelteKit + Cloudflare. It does not claim novelty; completeness and polish are the point.

## Operating Context

- Deliverable at this stage: a clickable static HTML prototype (all screens navigable, light/dark toggle), later ported to Svelte components.
- Must work on desktop (three-column: nav / feed / sidebar) and mobile (bottom tab bar).

## Capabilities and Constraints

- **Auth:** Google OAuth only. After first sign-in, a one-screen setup: pick @handle, display name (prefilled from Google), avatar. No passwords. (README still mentions email/password + GitHub; Google-only is the confirmed direction.)
- **Profiles:** display name, @handle, bio, avatar, header image, join date, follower/following counts, pinned post.
- **Posts:** 280-character limit. Images, GIFs, polls, link preview cards, location tags. Editable after publishing with an "Edited" label only (no history). Deletable, pinnable.
- **Follow model:** one-way. Private/protected accounts use follow requests the owner approves; posts hidden until approved; lock icon on profile.
- **Feed:** "For You" (algorithmic) and "Following" (chronological) tabs.
- **Engagement:** like, reply (threads), repost, quote-post, private bookmarks.
- **Threads:** chained replies; authors can link their own posts into a long thread.
- **Hashtags and @mentions:** hashtags group posts by topic; mentions tag and notify.
- **Search & discovery:** posts, users, hashtags; trending topics; who-to-follow.
- **Notifications:** likes, replies, reposts, new followers, mentions, follow requests; in-app plus push preferences.
- **DMs:** 1:1 and group chats (up to ~50 members); images and GIFs; reply-to-message and reactions.
- **Safety:** private accounts, block, mute (users, words, hashtags), report content, reply controls per post (Everyone / People you follow / Only people you mention).
- **Settings (product scope; full settings pages are out of scope for the current mockup, which shows in-context safety only):** change username, linked Google account (email shown, managed by Google; 2FA handled by Google), sessions/devices, notification preferences, data export, language switcher (UI visible; content stays English for the mockup).
- **i18n:** Paraglide with `en` and `ja` exists in the stack; mockup content is English only.

## Brand Commitments

- Name: **Jiyuu**.
- Minimal and plain, inspired by X and Bluesky; explicitly no over-the-top or bold design.
- Light and dark modes both required.
- Logo: wordmark `jiYuu` (lowercase except the middle Y, which is uppercase and accent-colored); standalone mark is a white Y in an accent-colored circle.
- Standing preference: the X/Bluesky category standard played straight (canon), not a novel visual direction. Sit alongside X and Bluesky at their craft level.

## Evidence on Hand

No real users, content, logos, or imagery exist. All demo content is synthetic and should read as such.

## Product Principles

1. Familiar first: people who know X or Bluesky should never have to learn a pattern.
2. Every required feature is visible and reachable in the prototype; completeness beats flourish.
3. Content leads, chrome recedes.
4. Safety controls sit one tap from the thing they control.
