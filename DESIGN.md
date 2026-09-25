---
name: Jiyuu
description: A plain, familiar short-form social network in the X/Bluesky canon, where content leads and chrome recedes.
colors:
  bg: "#ffffff"
  bg-2: "#f7f8f9"
  bg-3: "#eff1f3"
  bg-elev: "#ffffff"
  line: "#e6e8eb"
  line-2: "#cfd5da"
  text: "#0f1419"
  text-2: "#536471"
  text-3: "#6b7885"
  accent: "#1d9bf0"
  accent-text: "#0070c9"
  accent-fill: "#0070c9"
  accent-fill-hover: "#005ea9"
  accent-soft: "rgba(29, 155, 240, 0.1)"
  accent-soft-2: "rgba(29, 155, 240, 0.18)"
  unread: "rgba(29, 155, 240, 0.06)"
  on-accent: "#ffffff"
  like: "#d4146c"
  like-soft: "rgba(249, 24, 128, 0.1)"
  repost: "#007f55"
  repost-soft: "rgba(0, 186, 124, 0.12)"
  danger: "#d92c2c"
  danger-soft: "rgba(217, 44, 44, 0.08)"
  danger-fill: "#d92c2c"
  backdrop: "rgba(15, 20, 25, 0.42)"
  img-fallback: "#e3e7eb"
  bg-dark: "#161618"
  bg-2-dark: "#1d1d20"
  bg-3-dark: "#242428"
  bg-elev-dark: "#1f1f22"
  line-dark: "#2c2c31"
  line-2-dark: "#3d3d44"
  text-dark: "#ececef"
  text-2-dark: "#9a9aa3"
  text-3-dark: "#8b8b94"
  accent-text-dark: "#4cb0f5"
  accent-fill-dark: "#0a6fcf"
  accent-fill-hover-dark: "#1a7fdd"
  accent-soft-dark: "rgba(29, 155, 240, 0.14)"
  accent-soft-2-dark: "rgba(29, 155, 240, 0.24)"
  like-dark: "#f7508f"
  like-soft-dark: "rgba(247, 80, 143, 0.14)"
  repost-dark: "#2fc48d"
  repost-soft-dark: "rgba(47, 196, 141, 0.14)"
  danger-dark: "#f4575a"
  danger-soft-dark: "rgba(244, 87, 90, 0.12)"
  danger-fill-dark: "#c62828"
  backdrop-dark: "rgba(0, 0, 0, 0.6)"
  img-fallback-dark: "#2a2a2f"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", \"Noto Sans JP\", sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  tag: "4px"
  sm: "8px"
  nav: "10px"
  md: "12px"
  card: "16px"
  bubble: "20px"
  pill: "999px"
  circle: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  nav-w: "248px"
  main-w: "600px"
  rail-w: "330px"
components:
  button-primary:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-fill-hover}"
  button-primary-sm:
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  button-primary-lg:
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-ink:
    backgroundColor: "{colors.text}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.bg-2}"
  button-danger:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  icon-button:
    textColor: "{colors.text}"
    rounded: "{rounded.circle}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.bg-3}"
  search-field:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  text-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "6px 10px 8px"
  nav-item:
    textColor: "{colors.text}"
    rounded: "{rounded.nav}"
    padding: "10px 12px"
  nav-item-hover:
    backgroundColor: "{colors.bg-2}"
  post-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "12px 16px 4px"
  media-grid:
    backgroundColor: "{colors.line}"
    rounded: "{rounded.card}"
  panel:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.card}"
  quote-card:
    rounded: "{rounded.md}"
    padding: "10px 12px"
  menu-popover:
    backgroundColor: "{colors.bg-elev}"
    rounded: "{rounded.md}"
    padding: "6px 0"
  menu-item:
    typography: "{typography.label}"
    padding: "11px 16px"
  modal:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.card}"
    width: "600px"
  bubble-theirs:
    backgroundColor: "{colors.bg-3}"
    textColor: "{colors.text}"
    rounded: "{rounded.bubble}"
    padding: "9px 14px"
  bubble-mine:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.bubble}"
    padding: "9px 14px"
  chip:
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "4px 6px 4px 4px"
  toast:
    backgroundColor: "{colors.accent-fill}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  avatar:
    rounded: "{rounded.circle}"
    size: "40px"
---

# Design System: Jiyuu

## Overview

**Creative North Star: "The Category Standard, Played Straight"**

Jiyuu is the X/Bluesky short-form social network, built to the same craft level and with no novelty. Grounds are white or neutral charcoal. Dividers are hairlines, text is ink, and a single sky-blue accent is the only colour that isn't greyscale. Pink for likes and green for reposts appear only as engagement states. Nothing decorates. The feed column, the avatars and the posts carry the page, and the chrome around them gets out of the way.

Density is medium-high and list-driven. Rows run edge to edge inside a 600px bordered column. Hover washes are barely visible (`bg-2`), and every interactive row gets one. Type is the platform's own system UI face at 15px. Hierarchy comes from weight (700/800) rather than size jumps. Depth is flat at rest. Shadows appear only on things that float above the page: menus, dialogs, the toast, the FAB.

The build rejects novelty chrome, gradients and bold brand theatre. That rejection is the brief's thesis, and nothing in the build contradicts it.

**Key Characteristics:**
- Two complete palettes. Light is the default. Dark is neutral charcoal (#161618), not blue-black. `prefers-color-scheme` drives the switch, and `data-theme` can override it.
- One accent hue, split by job: brand blue for strokes and indicators, darker text-safe and fill-safe blues for words and filled surfaces.
- System UI type, weight-driven hierarchy, tabular numerals on counts.
- Circle avatars with hue-tinted initials, pill buttons, 16px media corners.
- 1.8px-stroke outline SVG icons, filled only to show an "on" state.
- Flat surfaces with hairline borders. Shadows only on floating layers.

## Colors

One sky-blue accent sits on neutral greys. Engagement pink and green appear only on hover or in the "on" state of their own actions.

### Primary
- **Sky Brand Blue** (`accent`): the logo colour. It marks the wordmark's Y and the circle mark. It is also the blue for non-text strokes and indicators: the `:focus-visible` ring, focus borders on search and fields, the text caret, the active-tab underline, the character-count ring, the DM unread dot, the active onboarding step pill and the "my reaction" chip border. It holds about 3.0:1 against white, which is right at the non-text floor. That leaves no headroom, so never thin these strokes below 2px.
- **Deep Link Blue** (`accent-text`, light): every piece of blue text or blue icon glyph. That covers links, "Show more", "Show this thread", the accent-coloured action hover, check marks, and the composer toolbar icons.
- **Deep Fill Blue** (`accent-fill`, light), hovering to `accent-fill-hover`: every filled blue surface carrying white content. That covers the primary button, badge, "mine" DM bubble, toast, FAB, the active switch, "new posts" pill, and native radio and checkbox `accent-color`.
- **Bright Link Blue** (`accent-text-dark`): blue text on the charcoal ground.
- **Dark-Mode Fill Blue** (`accent-fill-dark`, hovering to `accent-fill-hover-dark`): filled blue surfaces in dark mode. White on it reads at about 5:1.
- **Accent Washes** (`accent-soft`, `accent-soft-2`, `unread`): translucent brand blue. `accent-soft` sits behind the hover circle of blue actions and behind the location chip. `accent-soft-2` is the selection colour and the winning poll bar. `unread` tints unread notification rows.

### Secondary
- **Like Pink** (`like` / `like-dark`), with `like-soft` behind the hit circle: used only for the like action, on hover and when on, and for the like notification icon.
- **Repost Green** (`repost` / `repost-dark`), with `repost-soft`: used only for the repost action and its notification icon. It also marks the "handle available" form hint.

### Tertiary
- **Danger Red** (`danger` / `danger-dark`), with `danger-soft`: destructive menu items, the over-limit counter, field errors, the danger button, and the red hover on an "Following" button when unfollowing.

### Neutral
- **Paper White / Neutral Charcoal** (`bg` / `bg-dark`): the page ground and the modal surface.
- **Hover Mist** (`bg-2`): the hover wash on every row, the selected DM row, the auth art panel, the onboarding ground.
- **Recess Grey** (`bg-3`): recessed fills, meaning the search field, the DM input, "their" bubbles, the segmented control track, the icon-button hover, and poll bars.
- **Raised Surface** (`bg-elev`): popovers and the reaction picker. In light mode it is the same as `bg`, and the shadow separates them. In dark mode it steps up to #1f1f22.
- **Hairline** (`line`): every divider, column border, card border and media gutter.
- **Strong Hairline** (`line-2`): outline-button borders, input borders, thread connector lines, the switch-off track, the counter-ring track.
- **Ink** (`text`), **Slate** (`text-2`), **Faint Slate** (`text-3`): primary text; handles, timestamps and meta; placeholders and footers.
- **Image Fallback** (`img-fallback`): the placeholder fill behind any image that has not loaded.
- **Scrim** (`backdrop`): the overlay behind modals and the mobile drawer.

### Named Rules
**The Accent Split Rule.** Brand blue (#1d9bf0) never colours text and never fills a surface. Text uses `accent-text`, and filled surfaces use `accent-fill`, in each mode. Brand blue is kept for the logo, for strokes and indicators of 2px or more, and for translucent washes.

**The Earned Colour Rule.** Pink and green exist only as the state of their own action. They never appear as decoration, section colour or a second brand colour.

**The Charcoal Not Navy Rule.** The dark ground is neutral charcoal (#161618, stepping to #1d1d20 and #242428). Dark mode never tints its greys blue.

## Typography

**Display Font:** none. The system has no display tier.
**Body Font:** System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Noto Sans JP", sans-serif`)

**Character:** The platform's own face at native sizes. It is invisible on purpose and reads like the OS. Noto Sans JP is in the stack so the `ja` locale renders cleanly.

### Hierarchy
- **Headline** (800, 28px, 1.15, -0.02em): empty-state titles and the onboarding card title. This is the largest recurring size.
- **Title** (800, 20px, 1.2, -0.01em): sticky page-bar titles, modal and confirm-dialog titles, section headers, the profile name. Rail panel headers use a close sibling at 19px. The composer textarea also sets 20px, at weight 400.
- **Body Large** (400, 17px, 1.45): focused-post text, nav items, form input values, reply-box placeholder, sub-composer rows.
- **Body** (400, 15px, 1.4): post text, bios, menu text, messages (DM bubbles tighten to 1.35 line height). This is the page default. Names and buttons use it at 700 (**Label**). Menu items use 600.
- **Meta** (400, 13px): timestamps, action counts, trend context, the "Edited" tag, field labels, day separators.
- **Small** (500 to 800, 12px): the "Synthetic" note, message timestamps, reaction chips, the GIF badge.

### Named Rules
**The Weight Not Size Rule.** Hierarchy inside a row comes from weight and colour: a 700 name, a `text-2` handle, a `text-2` timestamp, all on one 15px line. Size jumps belong to page titles only.

**The Tabular Count Rule.** Every engagement count, follower count and character counter uses `font-variant-numeric: tabular-nums`, so numbers don't shift width when they change.

## Layout

The desktop layout is three centred, fixed-width columns: a sticky 248px left nav, a 600px main column bordered by hairlines on both sides, and a sticky 330px right rail with 28px left padding. The Messages screen uses a "wide" shell. It drops the rail and splits the main column into a 390px conversation list and a flexible chat pane.

The page gutter is 16px horizontally inside every row. The horizontal gap between avatar and content is 12px. Rows use 12px vertical padding, and notice rows and DM rows use 14px. Headers sit in a sticky bar at least 53px tall, with an 88% translucent ground, `saturate(180%) blur(14px)`, and a hairline underneath. Tabs are 52px tall and share the width equally. The selected tab gets a 4px by 56px brand-blue underline with a 2px radius.

Breakpoints:
- **1180px and below:** the nav collapses to an 88px icon rail. The wordmark, labels and account details hide. The compose button becomes a 52px circle. The rail narrows to 290px.
- **1010px and below:** the right rail hides. The wide shell fills `100vw - nav`, up to a 900px maximum. The DM list narrows to 320px.
- **700px and below:** the side nav hides. A mobile top bar appears, plus a fixed 56px bottom tab bar (translucent and blurred, respecting the safe-area inset) and a 56px compose FAB at bottom right. Every modal except the small confirm dialog goes full-screen with no radius. DM list and chat pane become one screen each. The profile header aspect goes to 2.6:1. The auth split collapses to one column.

## Elevation & Depth

Flat by default. Surfaces separate by hairline borders and by the `bg`/`bg-2`/`bg-3` tonal steps. Shadows exist only on layers that float above the page. Dark mode keeps the same two shadows but raises their opacity so they still read on charcoal.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 1px 2px rgba(15,20,25,.06), 0 8px 28px rgba(15,20,25,.14)`; dark `0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5)`): menus, the reaction picker, the toast, the FAB, the "new posts" pill.
- **Modal** (`box-shadow: 0 2px 6px rgba(15,20,25,.06), 0 24px 64px rgba(15,20,25,.22)`; dark `0 2px 6px rgba(0,0,0,.4), 0 24px 64px rgba(0,0,0,.6)`): dialogs over the scrim.
- **Ground Ring** (`box-shadow: 0 0 0 2px var(--bg)`): not depth. It is a knock-out ring that separates overlapping avatars and badges from the surface under them.

### Named Rules
**The Only-Floaters-Cast Rule.** Cards, panels, posts and media never cast shadows. Something gets a shadow only if it sits above the scroll plane.

## Shapes

Corners are soft and nest inward. The outer container gets the largest radius, and anything inside it steps down.
- **Circle** (50%): avatars, icon buttons, action hit targets, the FAB, the logo mark, the switch knob.
- **Pill** (999px): every text button, the search field, chips, the location chip, the reply-control button, the account chip, the "new posts" pill, the poll vote button.
- **Card** (16px): media grids, link cards, rail panels, modals, the onboarding card.
- **Medium** (12px): quote cards, popovers, pickers, the composer poll box, attachment thumbnails. Media inside a quote steps down to 10px.
- **Small** (8px): text fields, selects, poll result bars, the toast, GIF-grid tiles.
- **Nav** (10px): nav items and the segmented-control track. Segment buttons inside it are 8px.
- **Bubble** (20px): DM text bubbles. Image bubbles are 18px.
- **Tag** (4px): the GIF badge, the ALT badge, small pill-tags.

Borders are always 1px hairlines. The only exception is the 4px ground-colour ring around the profile avatar where it overlaps the header. Media grids clip with a 2px `line`-coloured gutter between tiles.

## Components

### Buttons
Familiar and quiet, weighted rather than loud.
- **Shape:** full pill (999px). Heights are 32px (sm), 36px (default) and 48px (lg). Horizontal padding is 14px, 16px and 24px. Labels are 700 weight.
- **Primary:** `accent-fill` with white text. Hover goes to `accent-fill-hover`. Disabled is 45% opacity.
- **Ink:** `text` background with `bg` text, so it inverts per mode. Hover is 88% opacity. Used for Follow.
- **Outline:** 1px `line-2` border on a transparent background. Hover goes to `bg-2`. "Following" uses this style and turns danger red on hover (border, text and `danger-soft` wash).
- **Danger / Danger outline:** used for confirmations such as delete and block. The filled button uses `danger-fill` (#d92c2c light, #c62828 dark) so white 15px bold labels clear 4.5:1 in both themes (4.83:1 / 5.62:1); `danger` / `danger-dark` stay for text, borders, and menu items.
- **Icon button:** a 36px circle in `text`. Hover gives a `bg-3` disc. The accent variant uses `accent-text` with an `accent-soft` disc.
- **Focus:** a 2px brand-blue outline at 2px offset (the global `:focus-visible` style).

### Chips
- **Style:** pill, 1px `line-2` border, 600 weight at 14px, with a leading avatar or icon in `text-2`. Used for selected recipients and muted words.
- **Location chip:** `accent-soft` fill, `accent-text` label, 600 weight.
- **Reaction chip:** 12px text on `bg` with a hairline border. It takes a brand-blue border on an `accent-soft` fill when the reaction is yours.

### Cards / Containers
- **Corner Style:** 16px for panels, media and link cards. 12px for quotes.
- **Background:** `bg`. Hover is `bg-2` on interactive cards.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px `line`.
- **Internal Padding:** 16px horizontal in panels. Link-card body is 10px 14px 12px. Quotes are 10px 12px.

### Inputs / Fields
- **Search:** 44px pill on `bg-3` with a transparent border. On focus-within it goes to `bg` with a brand-blue border and a brand-blue icon.
- **Floating-label field:** 1px `line-2` border, 8px radius, a 13px `text-2` label above a 17px value. On focus-within the border becomes brand blue with a 1px blue ring, and the label turns `accent-text`. Errors use the `danger` border and ring. Hints sit 13px below the field (green ok, red error, slate idle).
- **Select:** same border and radius, with an inline chevron and matching focus ring.
- **Switch:** a 40x24 track, `line-2` when off and `accent-fill` when on. The white knob slides 16px on the standard ease.
- **Segmented control:** a `bg-3` track with 3px padding. The pressed segment gets `bg` and a small shadow.

### Navigation
- **Desktop nav item:** 17px text, a 16px gap to its 24px icon, 10px 12px padding, 10px radius, `bg-2` hover. The current page is 700 weight. Badges are 18px `accent-fill` pills with a ground ring.
- **Tabs:** equal-width, 52px tall. Unselected tabs are `text-2` at 500 weight. The selected tab is `text` at 700 weight with the brand-blue underline.
- **Mobile:** a bottom tab bar with icons only. The current page is `text` with a 2.4 icon stroke, and the rest are `text-2`. A compose FAB sits above the bar.

### Icons
Inline SVGs on a 24px grid, drawn after Lucide geometry. They have no fill, use `stroke: currentColor` at 1.8 width, and have round caps and joins. They render at 20px by default, with 24px, 16px and 14px steps. An "on" state fills the icon, for example a liked heart or a saved bookmark. Repost is the exception: it thickens to a 2.4 stroke instead of filling. Icons take their colour from their parent text.

### Avatars
Circles at 24, 32, 36, 40 (default), 44, 48, 64, 96 and 134px. Without a photo, each user's hue (`--h`) tints the circle and its initials. The circle is `hsl(h 55% 88%)` with initials at `hsl(h 45% 28%)` in light mode. Dark mode inverts the lightness: the circle is `hsl(h 28% 28%)` with initials at `hsl(h 45% 84%)`. Initials are 700 weight at 38% of the circle's diameter. Stacks overlap by 8px with a 2px ground ring. Group avatars place two 28px circles diagonally in a 44px square.

### Post Card (signature)
A full-width row with a hairline bottom border and 12px 16px 4px padding. Hover gives a 70% `bg-2` wash. The layout has a 40px avatar gutter, which carries a 2px `line-2` thread connector when the post continues, then a 12px gap and the body. The header line holds a 700-weight name, then a `text-2` handle and timestamp with ellipsis truncation. An optional "Edited" tag follows in 13px `text-3`, and a more-button sits at the far end. Below the header come the text, then media, link card, quote or poll, each 12px down. The action row is last and runs up to 440px wide. Reply, repost and like are spread on the left, each with its count. Bookmark and share are grouped on the right. Each action has a 34px circular hit target, and its hover colours the icon, count and wash with that action's own colour. A context line ("reposted by", "pinned") can sit above the header in 13px 700-weight `text-2`, right-aligned to the avatar gutter.

### Focus Post
The expanded post at the head of a thread. Its header is avatar, name and handle on one row. The text is 17px at 1.45 line height. Below it sit a hairline-divided `text-2` row of timestamp and meta, a stats row (counts in 700-weight `text`, labels in `text-2`), and a full-width action bar. The bar spreads all five actions (reply, repost, like, bookmark, share) evenly with `space-between`. The right-hand group is dissolved, so it no longer clusters. Hit targets grow to 38px, and no counts are shown, because the stats row above already carries them. A reply-limit notice and an inline reply box follow.

### Composer
Opens in a 600px modal. The textarea has no border, sets 20px at 1.35 line height, and grows automatically. Thread sub-posts drop to 17px. Attachments sit in a grid of square 12px-radius tiles with 28px dark circular remove buttons. The poll editor is a 12px-radius hairline box of 44px inputs. Above the toolbar sits a reply-control pill in `accent-text`. The toolbar is `accent-text` icon buttons over a hairline. At its end sits a 22px character-count ring in brand blue, which turns amber and then danger red and scales 1.3x near the 280 limit. Next to the ring are a vertical separator, a 28px add-thread circle, and the primary Post button.

### Menus
Fixed popovers of 240 to 320px on `bg-elev`, with a 12px radius, hairline border, popover shadow and 6px vertical padding. Menu items are 15px 600-weight rows with a 12px icon gap, padded 11px 16px. They get `bg-2` on hover and on keyboard focus. Destructive items are `danger`. Separators are 1px `line` with 6px margins, and optional `text-2` 13px group labels head each section. The popover scales in from its trigger corner.

### Dialogs
A scrim (`backdrop`) fades in with the dialog 5vh from the top. The dialog is `bg`, with a 16px radius and the modal shadow, and it rises into place. Widths are 600px (default), 460px (md) and 380px (sm confirm, 20vh from the top). The header row is at least 53px: close icon-button, 20px 800-weight title, trailing action. The confirm dialog is padded 28px, with a `text-2` body and full-width 44px pill buttons stacked 10px apart.

### DM Bubbles
Messages sit in a column with 2px gaps and cap at 78% width (86% on mobile). "Their" bubbles are `bg-3` with `text`. "Mine" are `accent-fill` with white text and underlined white links, aligned right. Both have a 20px radius and 9px 14px padding. A 28px avatar marks the last message in a run, and earlier messages in the run keep its space with an invisible avatar. Reply references render as a hairline pill tucked under the bubble. Reaction chips overlap the bubble's bottom edge. On hover or focus, a reveal toolbar offers reply and react. The reaction picker is a pill on `bg-elev` with the popover shadow, and each emoji scales to 1.12x on hover. The input is a 22px-radius `bg-3` field.

### Toast
A centred toast 28px from the bottom (above the tab bar on mobile). It is an `accent-fill` bar with white text, an 8px radius and the popover shadow, and an optional bold underlined action link. It rises in when shown.

### Motion
One ease, `cubic-bezier(0.16, 1, 0.3, 1)`, drives everything that enters. State colour changes use 0.15s transitions. Entrances are short: the scrim fades in over 0.18s, dialogs rise over 0.28s (10px and 0.985 scale), and popovers scale in from 0.96 over 0.16s. The mobile drawer slides in over 0.3s, the toast rises over 0.32s, and poll bars grow from zero over 0.6s. The one moment of delight is the heart pop on like: the icon squashes to 0.7, overshoots to 1.22 and settles (0.42s). It is a scale-only animation with no ring or burst. The class uses a namespaced name (`popping` / `heart-pop`), which keeps it from colliding with the `.pop` popover class. Under `prefers-reduced-motion: reduce`, every animation and transition collapses to 0.001ms.

## Do's and Don'ts

### Do:
- **Do** put blue text in `accent-text` and blue fills in `accent-fill`, using each mode's value. Keep #1d9bf0 for the logo, for strokes and indicators of 2px or more, and for translucent washes.
- **Do** ship both palettes for every new surface. Dark is neutral charcoal #161618, stepping to #1d1d20, #242428 and #1f1f22 for raised surfaces.
- **Do** give every interactive row a `bg-2` hover wash and a 0.15s colour transition.
- **Do** build hierarchy inside rows from weight (700 names) and colour (`text-2` meta) at 15px.
- **Do** use 1.8-stroke outline icons with `currentColor`, filled only for an "on" state.
- **Do** nest radii inward: 16px outer cards and media, 12px inner quotes and popovers, 8px fields.
- **Do** use `tabular-nums` on every count.
- **Do** keep enter motion on the one ease-out curve, and keep the reduced-motion guard.

### Don't:
- **Don't** set text or a white-on-blue fill in #1d9bf0. White on it is about 3:1.
- **Don't** add gradients, novelty chrome or bold brand theatre. The thesis rejects them.
- **Don't** use pink or green except as the state of like and repost.
- **Don't** put shadows on posts, panels, cards or media. Shadows belong only to floating layers.
- **Don't** tint dark-mode greys blue.
- **Don't** add a web font or a display face. The system UI stack is the type system.
- **Don't** square off buttons. Every text button is a pill.
