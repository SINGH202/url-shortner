# Deploying to Render (free tier)

This gets you a live, public URL you can put on your portfolio. ~10 minutes.

## Prerequisites
- Your code pushed to a GitHub repo.
- A free account at https://render.com (sign in with GitHub).

---

## Step 1 — Create the database
1. In the Render dashboard: **New +  →  Postgres**.
2. Name it `urlshortener-db`, pick the **Free** plan, click **Create Database**.
3. Wait until its status is **Available**, then open it and copy the
   **Internal Database URL** (starts with `postgres://…`). You'll paste it in Step 2.

## Step 2 — Create the web service
1. **New +  →  Web Service**, then connect your GitHub repo.
2. Render auto-detects Node. Confirm these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Under **Environment**, add these variables:

   | Key            | Value                                              |
   |----------------|----------------------------------------------------|
   | `DATABASE_URL` | *(paste the Internal Database URL from Step 1)*    |
   | `BASE_URL`     | `https://<your-service-name>.onrender.com`         |

   > You won't know the exact `BASE_URL` until the service is created. You can
   > add it now with your best guess and correct it after the first deploy —
   > Render redeploys automatically when you change an env var.
   > (You do **not** need to set `PORT` — Render sets it for you.)

4. Click **Create Web Service**. Render builds and starts the app.

## Step 3 — Verify
Once the log shows `Server listening on ...`:
- Visit `https://<your-service>.onrender.com/health` → should return `{"status":"ok"}`.
- Shorten a link:
  ```bash
  curl -X POST https://<your-service>.onrender.com/shorten \
    -H "Content-Type: application/json" \
    -d '{"url":"https://github.com"}'
  ```
- Open the returned `shortUrl` in a browser → it redirects. 🎉

## Step 4 — Finish the portfolio touch
- Put the live URL in `README.md` (the "Live demo" line).
- Record a short GIF of it working and add it near the top of the README.

---

### Notes & gotchas
- **The schema is created automatically** on first boot (`db.init()` runs
  `schema.sql`), so there's no manual migration step.
- **Free tier sleeps** after ~15 min of inactivity; the first request afterward
  takes a few seconds to wake — normal, and fine for a portfolio demo.
- Never commit your real `.env` — it's already in `.gitignore`. On Render, all
  secrets live in the Environment tab, not in the repo.
