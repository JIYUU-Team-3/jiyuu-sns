# The member API

A member can make an API key in **Settings → API keys** and give it to an agent or script they run.
The key publishes text posts as that member and does nothing else.

## Using a key

Send the key as a bearer token and the post as JSON:

```bash
curl https://jiyuu.example/api/v1/posts \
  -H "Authorization: Bearer $JIYUU_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from my agent"}'
```

`POST /api/v1/posts` takes:

| Field            | Type                                                 | Notes                                    |
| ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| `text`           | string, required                                     | Same length and content rules as the app |
| `reply_audience` | `"everyone"` (default), `"following"`, `"mentioned"` | Who may reply                            |
| `link_preview`   | boolean, default `true`                              | `false` leaves the link card off         |

It answers `201` with `{ "id": "…", "url": "https://…/p/…" }`.

`GET /api/v1/me` answers `{ "handle": "…", "name": "…" }`, so an agent can check its key.

Errors come back as `{ "message": "…" }` with the status:

| Status | `message`                                           | Meaning                                     |
| ------ | --------------------------------------------------- | ------------------------------------------- |
| 400    | `post_invalid`, `post_duplicate`, a link refusal, … | The post broke a rule the composer enforces |
| 401    | `invalid_token`                                     | Missing, malformed or revoked key           |
| 403    | `suspended`, `no_profile`, `link_new_account`       | The account can't post right now            |
| 413    | `size`                                              | Body over 16 KB                             |
| 429    | `Too many requests.`, `post_rate`                   | Slow down                                   |

Always send `Content-Type: application/json`. A form or plain-text body from a client with no
`Origin` header is refused by SvelteKit's cross-site check before it reaches the API.

## What a key can't do

Photos and videos (uploads need a signed-in session), replies, quotes, polls, likes, follows,
messages, and reading anything. A key isn't a session: remote functions and pages still answer 401 to it.

## How it is kept safe

- A key is `jiyuu_` and 32 random bytes. Only its SHA-256 is stored (`api_token.hash`); the key
  is shown once, when it is made, and the list shows only its last four characters.
- Accounts in their first six hours, and accounts a moderator restricted, can't make keys.
  An account holds at most 5, counted in the statement that inserts (`create_token`).
- Every call is held to `API_LIMIT` per address before the key is looked up, then to the
  owner's `WRITE_LIMIT`. Posts go through `publish_posts` in `server/publish.ts`, the same path
  as the composer: trust-level pace, duplicate, link and spam checks, and the moderation queue.
- `api_member` in `server/api-tokens.ts` refuses suspended accounts and accounts without a
  profile, as `member()` does for sessions.
- Revoking deletes the row by id and owner together; deleting the account removes its keys.
- Responses carry no CORS headers, so a web page on another site can't call the API with a key.

The tests are in `server/api-tokens.spec.ts` and the API-key test in `routes/security.e2e.ts`.
