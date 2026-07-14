# Snip — URL Shortener

Production-ready URL shortener built with Next.js 16 and Supabase. Sign in, shorten links with optional custom slugs and expirations, redirect instantly, and track clicks with per-link analytics — all in one deployable app.

**Live demo:** [https://myshrinkly.vercel.app](https://myshrinkly.vercel.app)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)

---

## Features

- **Authenticated shortening** — email/password sign-up and sign-in via Supabase Auth; only signed-in users can create links
- **Password reset** — forgot-password email → `/auth/callback` (PKCE) → `/account/update-password`
- Shorten any `http`/`https` URL into a random 7-character base62 code (~3.5 trillion combinations)
- **Custom slugs** — pick your own 3–16 character path (letters, numbers, `-`, `_`)
- **Link expiration** — optional 1, 7, or 30 day expiry; expired links redirect to `/?notfound=1`
- **QR codes** — generate and download a PNG after shortening
- Instant redirects at `/<code>` with atomic click tracking
- **Dashboard** — list, copy, edit destination URLs, and delete your links
- **Analytics** — per-link click charts (14-day trend, referrer and country breakdowns)
- Collision-safe code generation (Web Crypto API + database `UNIQUE` constraint)
- **Rate limiting** — Postgres-backed IP throttle on shorten (10 requests / 60 seconds; bypassed when `NEXT_PUBLIC_IS_DEV=true`)
- Per-user Row Level Security (RLS) — users can only read and manage their own links
- **Social previews** — Open Graph + Twitter card metadata (`public/og.png`) for rich link previews when sharing the app
- Serverless-friendly: lazy Supabase clients, SSR session refresh via `proxy.ts`, works on Vercel out of the box

## Tech stack

| Layer     | Choice                      | Role                                      |
| --------- | --------------------------- | ----------------------------------------- |
| Framework | Next.js 16 (App Router)     | UI + API route handlers in one codebase   |
| Language  | TypeScript                  | End-to-end type safety                    |
| Styling   | Tailwind CSS v4             | UI styling                                |
| Database  | Supabase (Postgres + Auth)  | Storage, auth, atomic click counter       |
| Charts    | Recharts                    | Per-link analytics visualizations         |
| Hosting   | Vercel                      | Production deploys and preview branches   |

## Project structure

```
src/
├── proxy.ts                                 # Session refresh + optimistic /dashboard guard
├── app/
│   ├── page.tsx                             # Homepage (sign-in CTA or shorten form)
│   ├── ShortenForm.tsx                      # Shorten form with slug, expiry, QR (client)
│   ├── Header.tsx                           # Nav bar with auth state
│   ├── layout.tsx                           # Root layout + Open Graph / Twitter metadata
│   ├── login/                               # Email/password sign-in, sign-up, forgot password
│   ├── account/update-password/             # Set a new password after reset
│   ├── dashboard/                           # Link list + per-link analytics
│   ├── auth/
│   │   ├── callback/route.ts                # PKCE code exchange for reset / email links
│   │   └── signout/route.ts                 # POST sign-out
│   ├── api/
│   │   ├── shorten/route.ts                 # POST /api/shorten
│   │   └── links/[id]/route.ts              # PATCH / DELETE owned links
│   └── [code]/route.ts                      # GET /:code → redirect + analytics
└── lib/
    ├── supabase.ts                          # Anonymous singleton (redirects only)
    ├── supabase/server.ts                   # SSR client (cookies, auth)
    ├── supabase/client.ts                   # Browser client (login form)
    ├── env.ts                               # isDev() flag for local rate-limit bypass
    └── utils.ts                             # generateCode(), isValidUrl(), isValidSlug()
public/
└── og.png                                   # Open Graph / Twitter social preview image
schema.sql                                   # Tables, RLS, resolve_and_click(), rate limiting
```

---

## Prerequisites

- **Node.js 18+**
- **npm** (or compatible package manager)
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account for production deployment

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

In your Supabase project, open **SQL Editor**, paste the full contents of [`schema.sql`](./schema.sql), and run it.

This creates:

- `urls` table (`code`, `long_url`, `clicks`, `expires_at`, `user_id`, `created_at`)
- `click_events` table for per-click analytics (referrer, country, user agent)
- `rate_limits` table for IP-based throttling
- Per-user RLS policies on `urls` and `click_events`
- `resolve_and_click()` — atomic redirect, click increment, and event logging
- `check_rate_limit()` — sliding-window rate limiter

> **Important:** Run `schema.sql` manually. Serverless apps have no startup hook to auto-migrate the database.

### 3. Enable Supabase Auth

In **Supabase → Authentication → Providers → Email**:

1. Enable the Email provider
2. For local dev, consider disabling **Confirm email** so sign-up works immediately without inbox verification

Add your local redirect URL under **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**` (covers `/auth/callback`, where
  password-reset and verification links land)

For password-reset and verification emails to actually send, configure custom
SMTP under **Authentication → Emails → SMTP Settings** (the built-in mailer is
rate-limited and testing-only). If using Brevo, set **Username** to your Brevo
SMTP login and **Sender email** to a **verified sender** — not the
`…@smtp-brevo.com` login, which Brevo silently drops. See
[DEPLOY.md](./DEPLOY.md) § 1.3a for the full walkthrough.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in both values from **Supabase → Project Settings**:

| Variable                               | Where to find it                                      |
| -------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Data API → Project URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API Keys → **Publishable** key (`sb_publishable_…`)   |

Optional for local development:

| Variable                  | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_IS_DEV=true` | Disables rate limiting while developing locally  |

`.env.local` is gitignored. Never commit real credentials.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, paste a URL, and click **Shorten**.

### 6. Production build (local smoke test)

```bash
npm run build
npm run start
```

Use this before deploying to confirm the production bundle works with your env vars.

---

## App routes

| Path | Auth | Purpose |
| ---- | ---- | ------- |
| `/` | Optional | Homepage — sign-in CTA when logged out; shorten form when logged in |
| `/login` | Public | Sign in / sign up / forgot password |
| `/auth/callback` | Public | Exchange PKCE `code` for a session (password-reset emails) |
| `/auth/signout` | Session | Clear auth cookies and return home |
| `/account/update-password` | Required | Set a new password after reset (or while signed in) |
| `/dashboard` | Required | List, copy, edit, and delete your links |
| `/dashboard/[id]` | Required | Per-link analytics charts |
| `/[code]` | Public | Resolve short code → 302 redirect + click analytics |
| `POST /api/shorten` | Required | Create a short link |
| `PATCH /api/links/[id]` | Required | Update destination URL |
| `DELETE /api/links/[id]` | Required | Delete a link |

---

## API reference

### `POST /api/shorten`

Create a short link. **Requires authentication** (session cookie).

**Request**

```json
{
  "url": "https://example.com/page",
  "slug": "my-link",
  "expiresInDays": 7
}
```

| Field           | Required | Description                                      |
| --------------- | -------- | ------------------------------------------------ |
| `url`           | Yes      | Valid `http` or `https` URL                      |
| `slug`          | No       | Custom 3–16 character code; omit for random      |
| `expiresInDays` | No       | `1`, `7`, or `30`; omit or `0` for never expires |

**Success — `201 Created`**

```json
{
  "code": "aB3xK9q",
  "shortUrl": "https://your-domain.com/aB3xK9q",
  "expiresAt": "2026-07-10T12:00:00.000Z"
}
```

`expiresAt` is `null` when the link never expires.

**Errors**

| Status | Body                                              | Cause                        |
| ------ | ------------------------------------------------- | ---------------------------- |
| `400`  | `{ "error": "Request body must be valid JSON." }` | Malformed JSON               |
| `400`  | `{ "error": "Please provide a valid http(s) URL." }` | Invalid or non-http(s) URL |
| `400`  | `{ "error": "Custom links must be 3–16 characters…" }` | Invalid custom slug      |
| `401`  | `{ "error": "Please sign in to create short links." }` | Not authenticated        |
| `409`  | `{ "error": "That custom link is already taken…" }` | Slug collision           |
| `429`  | `{ "error": "Too many requests…" }`               | Rate limit exceeded          |
| `500`  | `{ "error": "Something went wrong saving your link." }` | Database error           |
| `500`  | `{ "error": "Could not generate a unique code…" }` | Random code retries exhausted |

**Example**

```bash
# Sign in via the browser first, then use the session cookie:
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -b "your-session-cookies" \
  -d '{"url":"https://developer.mozilla.org"}'
```

### `PATCH /api/links/:id`

Update a link's destination URL. **Requires authentication.** RLS ensures only the owner can update.

**Request**

```json
{ "longUrl": "https://example.com/new-destination" }
```

| Status | Description                    |
| ------ | ------------------------------ |
| `200`  | Updated successfully — `{ link }` |
| `400`  | Invalid URL or link id         |
| `401`  | Not authenticated              |
| `404`  | Link not found or not owned    |

### `DELETE /api/links/:id`

Permanently delete a link (and its `click_events` via cascade). **Requires authentication.**

| Status | Description                    |
| ------ | ------------------------------ |
| `200`  | Deleted successfully — `{ "ok": true }` |
| `401`  | Not authenticated              |
| `404`  | Link not found or not owned    |

### `GET /:code`

Resolve a short code, increment the click counter, record analytics, and redirect to the original URL. **No authentication required.**

| Status  | Behavior                                                |
| ------- | ------------------------------------------------------- |
| `302`   | Redirect to the stored `long_url`                       |
| `302`   | Redirect to `/?notfound=1` if the code does not exist or has expired |

**Example**

```bash
curl -L http://localhost:3000/aB3xK9q
```

> Redirects use **302 (temporary)**, not 301. Browsers cache 301 permanently, which would stop click tracking after the first visit.

---

## Environment variables

| Variable                               | Required | Description                                      |
| -------------------------------------- | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes      | Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase publishable key (`sb_publishable_…`)    |
| `NEXT_PUBLIC_IS_DEV`                   | No       | Set to `true` locally to disable rate limiting   |

The publishable key is used in both server and browser clients. Database access is governed by RLS policies defined in `schema.sql`. Redirects use a separate anonymous server client that calls the `SECURITY DEFINER` `resolve_and_click()` function.

---

## Security

- **Authentication required to shorten** — enforced in the API handler and by RLS insert policy
- **Per-user RLS** — signed-in users can only select, update, and delete their own links
- **Anonymous redirects** — public `GET /:code` uses `resolve_and_click()` (SECURITY DEFINER), not direct table access
- **Auth callback hardening** — `next` redirect targets are sanitized to local paths via `safeInternalPath()`
- **URL validation** — only `http:` and `https:` schemes are accepted (blocks `javascript:` and `data:` open-redirect abuse)
- **Cryptographic codes** — `crypto.getRandomValues()` instead of `Math.random()`
- **Rate limiting** — Postgres-backed sliding window on shorten requests (bypassed when `NEXT_PUBLIC_IS_DEV=true`)
- **No secrets in git** — use `.env.local` locally and Vercel Environment Variables in production
- **Lazy client init** — missing env vars fail at request time, not at build time

---

## Social link preview (Open Graph)

Sharing the site on Slack, LinkedIn, X/Twitter, iMessage, etc. uses metadata from `src/app/layout.tsx` and the image at [`public/og.png`](./public/og.png).

| Field | Value |
| ----- | ----- |
| Title | Snip — Short links with click analytics (~40 chars) |
| Description | Create short URLs with custom slugs, QR codes, and click analytics. Sign in to manage links and track every redirect. (~120 chars) |
| Image | `/og.png` (1200×630) |
| Twitter card | `summary_large_image` |
| `metadataBase` | `https://myshrinkly.vercel.app` |

Guidelines used: title under ~60 characters (avoids truncation to “Snip — short…”), description under ~160 characters, and a 1.91:1 image sized for Facebook/LinkedIn/X large cards.

---

## Production deployment

See **[DEPLOY.md](./DEPLOY.md)** for the full Vercel + Supabase deployment guide, auth configuration, SMTP setup, post-deploy checks, and troubleshooting.

**Pre-deploy checklist**

- [ ] `schema.sql` executed in Supabase SQL Editor
- [ ] `urls`, `click_events`, and `rate_limits` tables visible in Supabase Table Editor
- [ ] Supabase Auth email provider enabled; redirect URLs configured for your domain (`/**` covers `/auth/callback`)
- [ ] Custom SMTP configured if you need password-reset / verification emails
- [ ] Both env vars set in Vercel (Production + Preview if using branch deploys)
- [ ] `NEXT_PUBLIC_IS_DEV` **not** set in production
- [ ] `npm run build` passes locally
- [ ] Sign-in, password reset, shorten, redirect, dashboard, and analytics tested against production URL

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `Could not find the table 'public.urls'` (`PGRST205`) | Table not created | Run [`schema.sql`](./schema.sql) in Supabase SQL Editor |
| `new row violates row-level security policy` (`42501`) | RLS enabled without policies | Re-run the RLS section of `schema.sql` |
| `401` on shorten | Not signed in | Sign in at `/login` first |
| Sign-up succeeds but can't sign in | Email confirmation required | Disable confirm email in Supabase Auth settings for dev, or verify inbox |
| `over_email_send_rate_limit` on sign-up | Built-in Auth mailer limit | Disable confirm email for local testing, or configure custom SMTP |
| Reset/verification email never arrives (Auth log shows `200`, no error) | Sender email is not a verified sender (e.g. set to the SMTP login) | Verify a real sender in your SMTP provider and set it as **Sender email**; see [DEPLOY.md](./DEPLOY.md) § 1.3a |
| Reset link opens login with an error | Expired or used one-time code | Request a new reset from **Forgot password?** |
| Env var error on shorten | Missing or wrong credentials | Check `.env.local` / Vercel env vars match your Supabase project |
| Changes not reflected after code edit | Stale production build | Run `npm run build && npm run start` (not just `npm run start`) |
| Env change has no effect on Vercel | Deploy cache | Redeploy after updating environment variables |
| Analytics page empty | `click_events` not migrated | Re-run `schema.sql`; visit a short link to generate events |
| Social preview shows old image/title | Cached by the platform | Redeploy, then force-refresh with a sharing debugger |

**Verify database connectivity**

```bash
# Should return 200 (empty array is fine for anon; RLS may return [])
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/urls?select=code&limit=1"
```

**Inspect click counts**

```sql
SELECT code, clicks, long_url, expires_at, created_at
FROM urls
ORDER BY created_at DESC;
```

**Inspect analytics events**

```sql
SELECT ce.created_at, ce.referrer, ce.country, u.code
FROM click_events ce
JOIN urls u ON u.id = ce.url_id
ORDER BY ce.created_at DESC
LIMIT 20;
```

---

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start development server             |
| `npm run build` | Create production build              |
| `npm run start` | Serve production build               |
| `npm run lint`  | Run ESLint                           |

---
