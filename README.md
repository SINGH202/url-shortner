# Snip — URL Shortener

Production-ready URL shortener built with Next.js 16 and Supabase Postgres. Shorten links, redirect instantly, and track clicks — all in one deployable app.

**Live demo:** devshort.vercel.app

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)

---

## Features

- Shorten any `http`/`https` URL into a 7-character base62 code (~3.5 trillion combinations)
- Instant redirects at `/<code>` with atomic click tracking
- Collision-safe code generation (Web Crypto API + database `UNIQUE` constraint)
- Row Level Security (RLS) policies scoped to insert/update only what the app needs
- Serverless-friendly: lazy Supabase client, no session state, works on Vercel out of the box
- Clean UI with copy-to-clipboard, loading, and error states

## Tech stack

| Layer     | Choice                      | Role                                      |
| --------- | --------------------------- | ----------------------------------------- |
| Framework | Next.js 16 (App Router)     | UI + API route handlers in one codebase   |
| Language  | TypeScript                  | End-to-end type safety                    |
| Styling   | Tailwind CSS v4             | UI styling                                |
| Database  | Supabase (Postgres)         | Persistent storage + atomic click counter |
| Hosting   | Vercel                      | Production deploys and preview branches   |

## Project structure

```
src/
├── app/
│   ├── page.tsx              # Homepage (Server Component)
│   ├── ShortenForm.tsx         # Shorten form (Client Component)
│   ├── api/shorten/route.ts    # POST /api/shorten
│   └── [code]/route.ts         # GET /:code → redirect
└── lib/
    ├── supabase.ts             # Server-only Supabase client
    └── utils.ts                # generateCode(), isValidUrl()
schema.sql                      # Table, RLS policies, resolve_and_click()
legacy/                         # Original Express prototype (reference only)
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

- `urls` table (`code`, `long_url`, `clicks`, `created_at`)
- RLS policies for the `anon` role (insert + update)
- `resolve_and_click()` function for atomic redirect + click increment

> **Important:** Run `schema.sql` manually. Serverless apps have no startup hook to auto-migrate the database.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in both values from **Supabase → Project Settings**:

| Variable                             | Where to find it                          |
| ------------------------------------ | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Data API → Project URL                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API Keys → **Publishable** key (`sb_publishable_…`) |

`.env.local` is gitignored. Never commit real credentials.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a URL, and click **Shorten**.

### 5. Production build (local smoke test)

```bash
npm run build
npm run start
```

Use this before deploying to confirm the production bundle works with your env vars.

---

## API reference

### `POST /api/shorten`

Create a short link.

**Request**

```json
{ "url": "https://example.com/page" }
```

**Success — `201 Created`**

```json
{
  "code": "aB3xK9q",
  "shortUrl": "https://your-domain.com/aB3xK9q"
}
```

**Errors**

| Status | Body                                              | Cause                        |
| ------ | ------------------------------------------------- | ---------------------------- |
| `400`  | `{ "error": "Request body must be valid JSON." }` | Malformed JSON               |
| `400`  | `{ "error": "Please provide a valid http(s) URL." }` | Invalid or non-http(s) URL |
| `500`  | `{ "error": "Something went wrong saving your link." }` | Database error           |
| `500`  | `{ "error": "Could not generate a unique code, please try again." }` | Code collision retries exhausted |

**Example**

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://developer.mozilla.org"}'
```

### `GET /:code`

Resolve a short code, increment the click counter, and redirect to the original URL.

| Status  | Behavior                                                |
| ------- | ------------------------------------------------------- |
| `302`   | Redirect to the stored `long_url`                       |
| `302`   | Redirect to `/?notfound=1` if the code does not exist |

**Example**

```bash
curl -L http://localhost:3000/aB3xK9q
```

> Redirects use **302 (temporary)**, not 301. Browsers cache 301 permanently, which would stop click tracking after the first visit.

---

## Environment variables

| Variable                             | Required | Description                                      |
| ------------------------------------ | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`           | Yes      | Supabase project URL                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes    | Supabase publishable key (`sb_publishable_…`)    |

The Supabase client is only imported in server-side route handlers. Database access is governed by RLS policies defined in `schema.sql`.

---

## Security

- **URL validation** — only `http:` and `https:` schemes are accepted (blocks `javascript:` and `data:` open-redirect abuse)
- **Cryptographic codes** — `crypto.getRandomValues()` instead of `Math.random()`
- **RLS** — the publishable key can only insert rows and update via `resolve_and_click()`; no blanket read/delete access
- **No secrets in git** — use `.env.local` locally and Vercel Environment Variables in production
- **Lazy client init** — missing env vars fail at request time, not at build time

---

## Production deployment

See **[DEPLOY.md](./DEPLOY.md)** for the full Vercel + Supabase deployment guide, post-deploy checks, and troubleshooting.

**Pre-deploy checklist**

- [ ] `schema.sql` executed in Supabase SQL Editor
- [ ] `urls` table visible in Supabase Table Editor
- [ ] Both env vars set in Vercel (Production + Preview if using branch deploys)
- [ ] `npm run build` passes locally
- [ ] Shorten + redirect tested against production URL

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `Could not find the table 'public.urls'` (`PGRST205`) | Table not created | Run [`schema.sql`](./schema.sql) in Supabase SQL Editor |
| `new row violates row-level security policy` (`42501`) | RLS enabled without policies | Re-run the RLS section of `schema.sql` |
| Env var error on shorten | Missing or wrong credentials | Check `.env.local` / Vercel env vars match your Supabase project |
| Changes not reflected after code edit | Stale production build | Run `npm run build && npm run start` (not just `npm run start`) |
| Env change has no effect on Vercel | Deploy cache | Redeploy after updating environment variables |

**Verify database connectivity**

```bash
# Should return 200 (empty array is fine)
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/urls?select=code&limit=1"
```

**Inspect click counts**

```sql
SELECT code, clicks, long_url, created_at
FROM urls
ORDER BY created_at DESC;
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


