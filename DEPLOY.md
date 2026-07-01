# Deploying to Vercel + Supabase (free tier)

This gets you a live, public URL for your portfolio. ~15 minutes. Because the
frontend and backend are one Next.js app, there is a **single** deploy.

## Prerequisites

- Your code pushed to a GitHub repo.
- A free account at https://supabase.com
- A free account at https://vercel.com (sign in with GitHub).

---

## Step 1 — Create the Supabase database

1. In Supabase: **New project**. Give it a name and a strong database password,
   pick a region close to you, and wait for it to finish provisioning.
2. Open the **SQL Editor** → **New query**.
3. Paste the entire contents of [`schema.sql`](./schema.sql) and click **Run**.
   This creates the `urls` table and the `resolve_and_click()` function.
4. Grab your two credentials from **Project Settings**:
   - **Data API → Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **API Keys → `service_role`** → this is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     (⚠️ secret — it bypasses row-level security. Never expose it in the browser
     or commit it.)

## Step 2 — Import the project into Vercel

1. In Vercel: **Add New… → Project**, then import your GitHub repo.
2. Vercel auto-detects **Next.js** — leave the build settings at their defaults
   (Build: `next build`, no custom config needed).
3. Expand **Environment Variables** and add both keys:

   | Key                                    | Value                                 |
   | -------------------------------------- | ------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | _(your Project URL from Step 1)_      |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | _(your service_role key from Step 1)_ |

   > No `NEXT_PUBLIC_` prefix — that's deliberate. It keeps these values on the
   > server only, so the secret key never ships to the browser.

4. Click **Deploy**. Vercel builds and hosts the app, giving you a URL like
   `https://your-shortener.vercel.app`.

## Step 3 — Verify

- Open your Vercel URL, paste a long link, and hit **Shorten**.
- Click the resulting short link → it redirects. 🎉
- Or test the API directly:
  ```bash
  curl -X POST https://your-shortener.vercel.app/api/shorten \
    -H "Content-Type: application/json" \
    -d '{"url":"https://github.com"}'
  ```
- Back in Supabase → **Table Editor → urls**, watch rows appear and `clicks` rise.

## Step 4 — Finish the portfolio touch

- Put the live URL in `README.md` (the "Live demo" line).
- Record a short GIF of it working and add it near the top of the README.

---

### Notes & gotchas

- **Run `schema.sql` yourself, once** (Step 1). Unlike the old Express version,
  there is no auto-migration on boot — serverless functions have no single
  "startup" moment to run it.
- **Redeploys are automatic:** every `git push` to your main branch triggers a
  new Vercel deploy. Changing an env var requires a redeploy to take effect.
- **Env vars per environment:** Vercel lets you scope variables to Production /
  Preview / Development. Add them to all three if you use preview deployments.
- Never commit `.env.local` — it's already in `.gitignore`. In production, the
  values live in Vercel's Environment Variables tab, not in the repo.
