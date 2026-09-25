---
name: mockup-screenshots
description: Take desktop + mobile, light + dark screenshots of the main pages of the HTML mockup (design/mockup/index.html) into design/mockup/screenshots. Use when asked to "screenshot the mockup", "update/refresh mockup screenshots", or after the mockup HTML changes.
---

# Mockup screenshots

Captures `design/mockup/index.html` with Playwright across pages × devices × themes and writes
`design/mockup/screenshots/<page>-<device>-<theme>.png` (reruns overwrite).

## Matrix

- Pages (hash routes): `auth`, `home`, `explore`, `notifications`, `profile/mikatanaka`, `post/p2`, `messages`
- Devices: desktop 1440×900 @1x, mobile 390×844 @2x (`isMobile`, `hasTouch`)
- Themes: `light`, `dark` — forced via the mockup's `?theme=` query param (must come before the `#`) plus matching `colorScheme`

Screenshots are viewport-only (not full page): the feed is long and images are lazy-loaded from picsum.photos, so it needs network.

## Run

1. Playwright lives outside the repo (do not add it to package.json). One-time setup:
   ```sh
   mkdir -p ~/.cache/jiyuu-shots && cd ~/.cache/jiyuu-shots && npm init -y && npm i playwright
   npx playwright install chromium-headless-shell
   ```
   If launch fails with "Executable doesn't exist", rerun the `install` line from that directory.
2. From the repo root:
   ```sh
   node .claude/skills/mockup-screenshots/shoot.mjs
   ```
   Pass a page name (e.g. `home`) as the argument to capture just that page.

## Verify

Read a few PNGs (e.g. `home-desktop-dark`, `home-desktop-light`, `home-mobile-dark`, `post-mobile-light`) and check:
theme actually differs, mobile shows the bottom tab bar, images are not blank.

## Changing the set

Edit `PAGES`, `DEVICES`, or `THEMES` at the top of `shoot.mjs`. Routes come from `viewFor()` / `render()` in the mockup
(`auth`, `onboarding`, `home`, `post/<id>`, `profile/<handle>`, `explore`, `tag/<tag>`, `notifications`, `bookmarks`, `messages[/<convo-id>]` e.g. `c1`).
