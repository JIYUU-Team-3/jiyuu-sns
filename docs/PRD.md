# JIYUU SNS — Product Requirements

> Status: draft · Owner: JIYUU Team 3 · Last updated: 2026-09-25

## 1. Summary

JIYUU (自由, "freedom") is a small social network built for our Japanese class. Users sign up, set up a profile, write short posts, follow each other, and react with likes and comments. The whole UI ships in English and Japanese.

We want a working, deployed MVP that 5 people can build in parallel, one feature each, without stepping on each other.

## 2. Goals and non-goals

**Goals**

- A deployed app classmates can sign up for and use.
- Every screen available in both `en` and `ja` (Paraglide).
- Features split cleanly, so each team member owns one area end to end (schema → server → UI → tests).

**Non-goals (MVP)**

- Direct messages / chat
- Real-time updates (WebSockets, live feed). Refreshing the page is fine.
- Video, stories, reposts/quote posts
- Recommendation algorithms. Feeds are reverse-chronological.
- Mobile apps. The web app should be responsive, but there's no native app.
- Admin panel / moderation tooling beyond "delete your own content"

## 3. Users

| Persona | Needs                                                                  |
| ------- | ---------------------------------------------------------------------- |
| Student | Post in Japanese or English, follow classmates, see what they post     |
| Teacher | Same as a student; reads posts, comments                               |
| Visitor | Not logged in; can view public profiles and posts, must sign up to act |

## 4. Features

Priority: **P0** is required for the MVP, **P1** is the next thing if we have time, **P2** is a stretch goal.

### F1. Authentication — P0

Already scaffolded with Better Auth (email/password + Google). The demo lives in `src/routes/demo/better-auth`.

- Sign up with email + password; log in; log out
- Log in with Google
- Redirect logged-out users to `/login` from pages that need a session
- On first login, send the user to profile setup (F2) if they have no username yet
- P1: password reset by email (needs an email provider)

**Done when:** `/signup`, `/login`, and log out work in both languages, and the demo routes are removed.

### F2. Profiles — P0

- Each user has a unique `@username` (3–20 chars, `a-z0-9_`), display name, bio (≤ 160 chars), and avatar
- Public profile page at `/u/[username]`, showing the header, the user's posts, and follower/following counts
- `/settings/profile` to edit your own profile
- Avatar: MVP uses the Google avatar or a generated initial. P2: upload an image (needs an R2 bucket binding, which isn't set up yet)

**Done when:** a new user can pick a username, and other users can visit their profile page.

### F3. Posts — P0

- Create a text post (1–500 chars) from the home page
- View a single post at `/p/[id]`
- Delete your own post (with a confirm step)
- Show relative time ("3分前" / "3m ago") in the current locale
- P1: edit your own post (show "edited")
- P2: attach one image (needs R2)

**Done when:** a user can create, view and delete their posts, and the posts appear on their profile.

### F4. Feeds — P0

- `/` (logged in): home feed. Posts from people you follow, plus your own, newest first
- `/explore`: all public posts, newest first. This is also the logged-out landing view
- Cursor pagination ("Load more"), 20 posts per page
- Empty state for a new user: prompt them to follow people, with a link to `/explore`

**Done when:** following someone makes their posts show up in your home feed.

### F5. Follow — P0

- Follow / unfollow button on profiles
- `/u/[username]/followers` and `/u/[username]/following` lists
- You can't follow yourself; following twice has no effect

**Done when:** counts and lists update correctly and the home feed reflects them.

### F6. Likes and comments — P0 (likes) / P1 (comments)

- Like / unlike a post; show the like count and whether you liked it
- Comment on a post (1–300 chars), shown oldest first on `/p/[id]`
- Delete your own comment; a post's author can delete comments on their post

**Done when:** likes and comments persist, and counts show on feed cards.

### F7. Notifications — P1

- Create a notification when someone follows you, likes your post, or comments on your post
- `/notifications` list, newest first; the list is marked read when opened
- Unread badge in the navigation

### F8. Search — P1

- `/search?q=`: find users by username or display name, and posts by text
- P2: `#hashtags` in posts become links to `/search?q=%23tag`

### F9. Internationalization — P0 (cross-cutting)

- Every user-facing string goes through Paraglide (`messages/en.json`, `messages/ja.json`). Don't hardcode text in components
- Language switcher in the navigation; the choice is kept via URL/cookie (already configured)
- Dates and numbers are formatted with `Intl` using the current locale
- The Japanese copy should be natural, not machine-translated. This is a Japanese class project, so review it together

### F10. App shell and design — P0 (frontend owner)

- Layout: navigation (Home, Explore, Search, Notifications, Profile, language switch, log out), responsive down to 360px wide
- Shared components: `Button`, `Avatar`, `PostCard`, `PostComposer`, `UserListItem`, `EmptyState`, `LoadMore`
- Loading, error and 404 pages

Feature owners build their pages with these shared components. Until a component exists, use a plain placeholder and replace it later.

## 5. Data model (draft)

Better Auth owns `user`, `session`, `account`, `verification` in `auth.schema.ts`. That file is generated, so don't edit it by hand. App tables go in `src/lib/server/db/schema.ts`. Timestamps use the same `timestamp_ms` integer style as the auth schema.

| Table          | Columns                                                                                           | Notes                                   |
| -------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `profile`      | `user_id` PK → user, `username` unique, `display_name`, `bio`, `avatar_url`, `created_at`         | 1:1 with `user`                         |
| `post`         | `id` PK, `author_id` → user, `body`, `created_at`, `updated_at`                                   | index `(author_id, created_at)`         |
| `follow`       | `follower_id` → user, `following_id` → user, `created_at`                                         | PK `(follower_id, following_id)`        |
| `post_like`    | `user_id` → user, `post_id` → post, `created_at`                                                  | PK `(user_id, post_id)`                 |
| `comment`      | `id` PK, `post_id` → post, `author_id` → user, `body`, `created_at`                               | index `(post_id, created_at)`           |
| `notification` | `id` PK, `user_id` → user, `actor_id` → user, `type`, `post_id` nullable, `read_at`, `created_at` | `type`: `follow` \| `like` \| `comment` |

All foreign keys use `onDelete: 'cascade'`. The demo `task` table is removed.

**To avoid migration conflicts, land the whole P0 schema (`profile`, `post`, `follow`, `post_like`, `comment`) in one pull request before feature work starts.** Later schema changes follow the process in [CONTRIBUTING.md](../CONTRIBUTING.md#database-changes).

## 6. Routes

| Route                     | Feature | Auth required           |
| ------------------------- | ------- | ----------------------- |
| `/`                       | F4      | yes (else → `/explore`) |
| `/explore`                | F4      | no                      |
| `/login`, `/signup`       | F1      | no                      |
| `/settings/profile`       | F2      | yes                     |
| `/u/[username]`           | F2      | no                      |
| `/u/[username]/followers` | F5      | no                      |
| `/u/[username]/following` | F5      | no                      |
| `/p/[id]`                 | F3, F6  | no (acting needs login) |
| `/notifications`          | F7      | yes                     |
| `/search`                 | F8      | no                      |

## 7. Non-functional requirements

- **Security:** every write checks `event.locals.user` on the server, and only the owner can edit or delete their content. Validate lengths on the server, not just in the form.
- **Performance:** feed and profile pages load with a bounded number of D1 queries (no query per post, so no N+1). Paginate every list.
- **Accessibility:** use real buttons and links, labelled form fields, and alt text on avatars.
- **Quality:** CI must pass (lint, typecheck, unit tests, build, e2e). Each P0 feature has at least one e2e happy-path test, tagged `@writes` if it creates data.

## 8. Team split

5 people: the frontend owner plus 4 feature owners. Fill in names when the team agrees.

| Area                                 | Features         | Owner               |
| ------------------------------------ | ---------------- | ------------------- |
| App shell, design, shared components | F10, F9 switcher | _frontend teammate_ |
| Auth + profiles                      | F1, F2           | TBD                 |
| Posts + feeds                        | F3, F4           | TBD                 |
| Social graph + likes/comments        | F5, F6           | TBD                 |
| Notifications + search               | F7, F8           | TBD                 |

Whoever owns a feature also owns its `en`/`ja` strings and tests.

## 9. Milestones

| Milestone | Scope                                                                |
| --------- | -------------------------------------------------------------------- |
| M0 Setup  | Everyone runs the app locally; P0 schema PR merged; app shell merged |
| M1 Core   | F1, F2, F3, F5 working end to end                                    |
| M2 Social | F4 feeds, F6 likes and comments                                      |
| M3 Polish | F7, F8, Japanese copy review, responsive/a11y pass, demo data        |

Set dates to fit the class schedule.

## 10. Open questions

- Should posts be public to logged-out visitors, or only to classmates?
- Does the class want a "Japanese practice" angle (e.g. furigana, a JLPT-level tag on posts)? That would be a P2 feature.
- Do we need image uploads for the demo? That needs an R2 bucket and binding.
