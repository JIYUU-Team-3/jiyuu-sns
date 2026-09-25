# Contributing

How the 5 of us work on JIYUU SNS without breaking each other's work or the live site. What we're building is in [docs/PRD.md](docs/PRD.md); the stack and scripts are in [README.md](README.md).

## The one rule

**Never push directly to `development`.** Every push to `development` deploys to production. All changes go through a pull request with CI passing.

## First-time setup

```sh
git clone git@github.com:JIYUU-Team-3/jiyuu-sns.git
cd jiyuu-sns
pnpm install             # also installs the git hooks
cp .env.example .env     # placeholder values are fine for local dev
pnpm db:migrate:local    # create the local D1 database
pnpm dev
```

Use pnpm, not npm or yarn. The repo enforces it with `engine-strict`.

## Workflow

1. **Pick up an issue.** Every piece of work has a GitHub issue tied to a feature in the PRD (F1–F10). If there isn't one, create it first.
2. **Branch from the latest `development`:**

   ```sh
   git switch development
   git pull
   git switch -c 12-profile-page   # <issue number>-<short-description>
   ```

   You can also use "Create a branch" on the issue page, which gives the same format.

3. **Commit small and often**, using [Conventional Commits](https://www.conventionalcommits.org/) like the existing history:

   | Prefix      | Use for                           |
   | ----------- | --------------------------------- |
   | `feat:`     | new user-facing behaviour         |
   | `fix:`      | bug fix                           |
   | `refactor:` | code change with no new behaviour |
   | `docs:`     | README, PRD, comments             |
   | `test:`     | tests only                        |
   | `chore:`    | tooling, deps, config             |

   Example: `feat(profile): add follower count to profile header`

4. **Keep your branch up to date.** Merge `development` into your branch at least once a day while you're working:

   ```sh
   git fetch origin
   git merge origin/development
   ```

   PRs are squash-merged, so these merge commits never reach `development`.

5. **Open a pull request into `development`.** In the description, link the issue (`Closes #12`) and add screenshots for UI changes. Keep PRs small. One feature slice per PR is much easier to review than a whole feature at once.
6. **Get one approval and a green CI**, then squash-merge. Delete the branch afterwards.

## Stay in your lane

Each person owns an area (see the team split in the PRD). To avoid merge conflicts:

- Put feature code in the feature's own folders: `src/routes/<route>/` for pages and `src/lib/server/<feature>.ts` for database queries.
- The frontend owner owns the shared layout (`src/routes/+layout.svelte`) and shared components in `src/lib/components/`. If you need a change there, ask them or open a small separate PR rather than editing it inside your feature PR.
- If you need something from another person's feature (e.g. the feed needs the follow list), agree on the function name and return type first, then each person builds their side.

## Database changes

Migration files are the most likely thing to conflict. Two branches that each run `pnpm db:generate` both create a migration with the same number.

1. Edit `src/lib/server/db/schema.ts`. Never edit `auth.schema.ts` or anything under `drizzle/` by hand.
2. Run `pnpm db:generate`, read the SQL it wrote, then run `pnpm db:migrate:local`.
3. Commit `schema.ts` and the whole `drizzle/` folder, including `drizzle/meta/`.
4. Tell the group chat you're merging a schema change.

**If your PR conflicts on `drizzle/`:** don't try to merge the files by hand.

```sh
git fetch origin
git merge origin/development                   # stop at the conflict in drizzle/
git checkout origin/development -- drizzle/    # take development's migrations as they are
pnpm db:generate                               # regenerate your migration on top of them
pnpm db:migrate:local
git add drizzle/ src/lib/server/db/schema.ts
git commit
```

In short: reset `drizzle/` to what's on `development`, keep your `schema.ts` change, and regenerate. If `schema.ts` itself conflicts, keep both sides' tables before regenerating.

If your local database gets into a weird state, delete `.wrangler/state` and run `pnpm db:migrate:local` again. That only wipes your local data.

## Translations (en / ja)

- No hardcoded text in components. Add a key to **both** `messages/en.json` and `messages/ja.json`, then use it as `m.key_name()`.
- Prefix keys with your feature so we don't collide: `profile_edit_title`, `post_delete_confirm`, `feed_empty_title`.
- Add new keys at the end of your feature's group, not in random places. That keeps merge conflicts easy to resolve.
- If you're not sure about the Japanese, add it anyway and mark the PR with "needs JP review" so someone can check it.

## Checks and tests

The git hooks run automatically:

- **On commit:** Prettier (auto-fixes) and ESLint on the files you changed
- **On push:** `pnpm run check` (typecheck) and the unit tests

If the push is blocked, fix the error. Don't skip the hooks with `LEFTHOOK=0` unless you're pushing a work-in-progress branch that you know is broken. CI runs the same checks anyway, and a PR can't merge while they fail.

Before opening a PR, it's worth running:

```sh
pnpm lint
pnpm check
pnpm test:unit --run
```

Tests:

- Unit tests: `*.spec.ts` next to the code (`*.svelte.spec.ts` for components).
- E2E tests: `*.e2e.ts` next to the route they cover. Tag any test that creates data with `@writes`. The post-deploy run skips those so it never writes to production.
- Each P0 feature needs at least one e2e happy-path test.

## Server code rules

- Every action or remote function that writes data must check `event.locals.user` and return 401 if there's no session.
- Check ownership on the server before edit or delete (`post.author_id === user.id`). Hiding the button in the UI isn't enough.
- Validate input lengths and formats on the server.
- Paginate every list, and don't run a query inside a loop over posts.

## Secrets

- Never commit `.env`. It's git-ignored; keep it that way.
- Don't paste real secrets (Cloudflare tokens, `BETTER_AUTH_SECRET`, Google OAuth secret) into issues, PRs, or chat. The production values live in GitHub repository secrets and in Worker secrets.

## Reviewing a PR

When you review a teammate's PR, check that:

- it does what the issue asked, and nothing unrelated
- all new text is in both `en.json` and `ja.json`
- writes are checked for login and ownership on the server
- there's a test for the main path
- you pulled the branch and tried it locally if it changes UI

Approve if it's good enough to ship. Small nitpicks can be follow-up issues.
