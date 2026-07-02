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

Confirm in **Table Editor** that the `urls` table exists with columns: `id`, `code`, `long_url`, `clicks`, `created_at`.

### What `schema.sql` sets up

| Object | Purpose |
| ------ | ------- |
| `urls` table | Stores short codes, original URLs, and click counts |
| RLS policies | Allows `anon` role to insert rows and update clicks only |
| `resolve_and_click()` | Atomically increments clicks and returns `long_url` in one query |

> If you created the table manually in the Table Editor before running `schema.sql`, re-run the full file anyway. `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` are safe to re-execute; policy creation may need a one-time clean-up if policies already exist with different names.

### 1.3 Collect credentials

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

Add both variables before the first deploy:

| Key | Value |
| --- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase Publishable key |

**Scope:** enable for **Production**, **Preview**, and **Development** if you use preview deployments or Vercel's local dev integration.

> Do not store credentials in the repository. Vercel Environment Variables are the source of truth in production.

### 2.3 Deploy

Click **Deploy**. Vercel runs `npm install` and `next build`, then assigns a URL like:

```
https://your-shortener.vercel.app
```

---

## Step 3 — Verify production

### UI smoke test

1. Open your Vercel URL
2. Paste a long `https://` URL and click **Shorten**
3. Copy the short link and open it in a new tab — you should land on the original URL
4. In Supabase **Table Editor → urls**, confirm the row exists and `clicks` incremented

### API smoke test

```bash
# Replace with your production domain
export APP_URL="https://your-shortener.vercel.app"

# Create a short link
curl -s -X POST "$APP_URL/api/shorten" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com"}' | jq .

# Follow the redirect (-L)
curl -s -o /dev/null -w "HTTP %{http_code} → %{redirect_url}\n" -L "$APP_URL/<code-from-above>"
```

Expected: `201` from shorten, `200` or `302` chain ending at GitHub.

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
3. No code changes required — `shortUrl` is built from the request origin at runtime

After adding a domain, re-test shorten and redirect on the new hostname.

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
| API errors | Vercel → Project → **Logs** (Runtime Logs) |
| Build failures | Vercel → Deployments → failed build log |
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

**Fix:** Re-run the RLS policy section of `schema.sql`. The publishable key operates as the `anon` role and requires explicit insert/update policies.

### `500` on shorten after deploy

1. Confirm both env vars are set in Vercel for the correct environment (Production vs Preview)
2. Confirm env var values match the Supabase project where `schema.sql` was run
3. Redeploy after env changes
4. Check Vercel Runtime Logs for the underlying Supabase error

### Stale behavior after local code changes

`npm run start` serves the last `npm run build` output. After editing code:

```bash
npm run build && npm run start
```

### Preview deployments fail but production works

Preview branches need the same env vars scoped to **Preview** in Vercel. A preview deploy pointing at a different Supabase project will fail if that project's schema is not set up.

---

## Security notes for production

- Keep `.env.local` out of git (already in `.gitignore`)
- Use the **Publishable** key with RLS — do not expose the `service_role` key in client-accessible env vars
- Only `http`/`https` URLs are accepted by the API
- Consider rate limiting at the edge (Vercel Firewall / middleware) if you expose the API publicly at scale

---

## Post-deploy

- [ ] Add your live URL to the **Live demo** line in [`README.md`](./README.md)
- [ ] Run the API smoke tests above against production
- [ ] Confirm click counts increment in Supabase after visiting a short link
