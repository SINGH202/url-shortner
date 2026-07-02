# Production deployment — Vercel + Supabase

Deploy Snip to production in ~15 minutes. The app is a single Next.js project: one build, one deploy, frontend and API together.

---

## Pre-deploy checklist

Before you start, confirm you have:

- [ ] Code pushed to a GitHub repository
- [ ] A [Supabase](https://supabase.com) project (note the region — pick one close to your users)
- [ ] A [Vercel](https://vercel.com) account connected to GitHub
- [ ] Node 18+ locally to run `npm run build` as a final check

---

## Step 1 — Provision Supabase

### 1.1 Create the project

1. Supabase → **New project**
2. Choose a name, strong database password, and region
3. Wait for provisioning to finish

### 1.2 Run the database schema

1. Open **SQL Editor** → **New query**
2. Paste the entire contents of [`schema.sql`](./schema.sql)
3. Click **Run**

Confirm in **Table Editor** that these tables exist:

| Table          | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `urls`         | Short codes, destinations, click totals, expiry   |
| `click_events` | Per-click analytics (referrer, country, user agent) |
| `rate_limits`  | IP-based sliding-window rate limiter              |

The `urls` table should have columns: `id`, `code`, `long_url`, `clicks`, `expires_at`, `user_id`, `created_at`.

### What `schema.sql` sets up

| Object | Purpose |
| ------ | ------- |
| `urls` table | Stores short codes, original URLs, click counts, expiry, and owner |
| `click_events` table | Detailed click log for per-link analytics |
| `rate_limits` table | Tracks recent requests per IP for throttling |
| RLS policies | Authenticated users can only access their own links and events |
| `resolve_and_click()` | Atomically increments clicks, logs an event, and returns `long_url` |
| `check_rate_limit()` | Sliding-window IP throttle for the shorten endpoint |

> If you created tables manually before running `schema.sql`, re-run the full file anyway. `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` are safe to re-execute.

### 1.3 Configure authentication

1. **Authentication → Providers → Email** — enable the Email provider
2. For production, keep **Confirm email** enabled; for quick testing, you can disable it temporarily
3. **Authentication → URL Configuration**:
   - **Site URL:** `https://your-shortener.vercel.app` (update after deploy)
   - **Redirect URLs:** add `https://your-shortener.vercel.app/**` and any custom domain

### 1.4 Collect credentials

From **Project Settings**:

| Setting | Environment variable |
| ------- | -------------------- |
| Data API → **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| API Keys → **Publishable key** | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

Use the **Publishable** key (`sb_publishable_…`), not the secret `service_role` key. Access is restricted by RLS policies in `schema.sql`.

---

## Step 2 — Deploy to Vercel

### 2.1 Import the repository

1. Vercel → **Add New… → Project**
2. Import your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Build command: `next build` (default)
5. Output: Next.js default (no custom config needed)

### 2.2 Set environment variables

Add both required variables before the first deploy:

| Key | Value |
| --- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key |

**Do not** set `NEXT_PUBLIC_IS_DEV` in production — rate limiting should remain active.

**Scope:** enable for **Production**, **Preview**, and **Development** if you use preview deployments or Vercel's local dev integration.

> Do not store credentials in the repository. Vercel Environment Variables are the source of truth in production.

### 2.3 Deploy

Click **Deploy**. Vercel runs `npm install` and `next build`, then assigns a URL like:

```
https://your-shortener.vercel.app
```

After deploy, update Supabase **Site URL** and **Redirect URLs** to match your Vercel domain.

---

## Step 3 — Verify production

### UI smoke test

1. Open your Vercel URL
2. Click **Sign in** and create an account (or sign in)
3. Paste a long `https://` URL and click **Shorten**
4. Copy the short link and open it in a new tab — you should land on the original URL
5. Open **Dashboard** — confirm the link appears with click count
6. Click the link's analytics view — confirm charts populate after a few clicks
7. In Supabase **Table Editor → urls**, confirm the row exists with your `user_id` and `clicks` incremented
8. In **Table Editor → click_events**, confirm event rows were created

### API smoke test

```bash
# Replace with your production domain
export APP_URL="https://your-shortener.vercel.app"

# Create a short link (requires session cookie from browser sign-in)
curl -s -X POST "$APP_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -b "your-session-cookies" \
  -d '{"url":"https://github.com"}' | jq .

# Follow the redirect (-L) — no auth needed
curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" -L "$APP_URL/<code-from-above>"
```

Expected: `201` from shorten (when authenticated), `302` chain ending at GitHub.

### Database connectivity check

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/urls?select=code&limit=1"
```

Expected: `200`

---

## Step 4 — Custom domain (optional)

1. Vercel → your project → **Settings → Domains**
2. Add your domain and follow DNS instructions
3. Update Supabase **Site URL** and **Redirect URLs** to include the new domain
4. No code changes required — `shortUrl` is built from the request origin at runtime

After adding a domain, re-test sign-in, shorten, redirect, and dashboard on the new hostname.

---

## Operations

### Automatic deploys

Every push to your production branch (usually `main`) triggers a new Vercel deploy.

### Environment variable changes

Updating env vars in Vercel does **not** affect running deployments until you **redeploy**. After changing Supabase credentials, trigger a redeploy from the Vercel dashboard.

### Database changes

There is no migration runner in this app. Schema changes are applied manually:

1. Write and test SQL locally or in a Supabase branch project
2. Run the SQL in Supabase **SQL Editor** on production
3. Redeploy the app if env vars or code changed

### Monitoring

| What to watch | Where |
| ------------- | ----- |
| Row growth and click counts | Supabase → Table Editor → `urls` |
| Analytics event volume | Supabase → Table Editor → `click_events` |
| Rate limit table size | Supabase → Table Editor → `rate_limits` (auto-pruned) |
| API errors | Vercel → Project → **Logs** (Runtime Logs) |
| Build failures | Vercel → Deployments → failed build log |
| Auth issues | Supabase → **Authentication → Logs** |
| Database health | Supabase → **Reports** |

---

## Troubleshooting

### `PGRST205` — table not found

```
Could not find the table 'public.urls' in the schema cache
```

**Fix:** Run [`schema.sql`](./schema.sql) in the Supabase SQL Editor. Confirm the `urls` table appears in Table Editor.

### `42501` — row-level security violation

```
new row violates row-level security policy for table "urls"
```

**Fix:** Re-run the RLS policy section of `schema.sql`. Shortening requires an authenticated user — the insert policy checks `auth.uid() = user_id`.

### `401` on shorten

**Fix:** The user must be signed in. Confirm Supabase Auth is configured and redirect URLs include your deployment domain.

### Sign-up works but sign-in fails

**Fix:** Check whether **Confirm email** is enabled. Users must verify their inbox before a session is created, unless you disable confirmation in Supabase Auth settings.

### `500` on shorten after deploy

1. Confirm both env vars are set in Vercel for the correct environment (Production vs Preview)
2. Confirm env var values match the Supabase project where `schema.sql` was run
3. Redeploy after env changes
4. Check Vercel Runtime Logs for the underlying Supabase error

### Analytics page shows no data

1. Confirm `click_events` table exists (re-run `schema.sql`)
2. Visit the short link at least once to generate events
3. Check Vercel Runtime Logs for `resolve_and_click` errors

### Stale behavior after local code changes

`npm run start` serves the last `npm run build` output. After editing code:

```bash
npm run build && npm run start
```

### Preview deployments fail but production works

Preview branches need the same env vars scoped to **Preview** in Vercel. A preview deploy pointing at a different Supabase project will fail if that project's schema is not set up. Add preview URLs to Supabase redirect URLs if using auth on preview deploys.

---

## Security notes for production

- Keep `.env.local` out of git (already in `.gitignore`)
- Use the **Publishable** key with RLS — do not expose the `service_role` key in client-accessible env vars
- Only `http`/`https` URLs are accepted by the API
- Do not set `NEXT_PUBLIC_IS_DEV=true` in production
- Rate limiting is enforced at the API layer; consider additional edge protection (Vercel Firewall) at scale

---

## Post-deploy

- [ ] Add your live URL to the **Live demo** line in [`README.md`](./README.md)
- [ ] Update Supabase Auth redirect URLs for your production domain
- [ ] Run the UI and API smoke tests above against production
- [ ] Confirm click counts and `click_events` rows increment after visiting a short link
