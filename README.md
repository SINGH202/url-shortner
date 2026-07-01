# 🔗 Snip — a URL shortener

Turn long, ugly links into short, shareable ones. A full-stack URL shortener
built as a single Next.js app and deployed to Vercel.

**Live demo:** _add your Vercel URL here after deploying_

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white)

---

## ✨ Features

- **Shorten any http(s) URL** into a 7-character code (base62, ~3.5 trillion combos).
- **Instant redirects** from `yoursite.com/<code>` to the original link.
- **Click tracking** — every visit is counted atomically in the database.
- **Secure, collision-safe codes** via the Web Crypto API + a `UNIQUE` DB constraint.
- **Clean UI** with copy-to-clipboard, loading and error states.
- One codebase, one deploy — frontend and backend together on Vercel.

## 🧱 Tech stack & architecture

| Layer     | Choice                      | Why                                  |
| --------- | --------------------------- | ------------------------------------ |
| Framework | **Next.js 16 (App Router)** | Frontend + backend in one project    |
| Language  | **TypeScript**              | Type safety across the stack         |
| Styling   | **Tailwind CSS v4**         | Fast, consistent UI                  |
| Database  | **Supabase (Postgres)**     | Serverless-friendly managed Postgres |
| Hosting   | **Vercel**                  | Zero-config Next.js deploys          |

```
src/
├─ app/
│  ├─ page.tsx            # Homepage (Server Component) — the shell
│  ├─ ShortenForm.tsx     # Client Component — the interactive form
│  ├─ api/shorten/route.ts# POST: validate → generate code → store
│  └─ [code]/route.ts     # GET: look up code → count click → redirect
└─ lib/
   ├─ supabase.ts         # Lazy, server-only Supabase client
   └─ utils.ts            # generateCode() + isValidUrl()
schema.sql                # Table + atomic resolve_and_click() function
legacy/                   # The original Express prototype (kept for history)
```

## 🚀 Run it locally

**Prerequisites:** Node 18+ and a free [Supabase](https://supabase.com) account.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the database.** In your Supabase project, open **SQL Editor**, paste
   the contents of [`schema.sql`](./schema.sql), and run it. This creates the
   `urls` table and the `resolve_and_click()` function.

3. **Add your credentials.** Copy the example env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   Get both values from **Supabase → Project Settings**:
   - `NEXT_PUBLIC_SUPABASE_URL` — Data API → Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — API Keys → `service_role` (keep secret!)

4. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>, paste a long URL, and hit **Shorten**.

## 🧪 Try the API directly

```bash
# Shorten a URL
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://developer.mozilla.org"}'
# → { "code": "aB3xK9q", "shortUrl": "http://localhost:3000/aB3xK9q" }

# Follow the short link (‑L follows the redirect)
curl -L http://localhost:3000/aB3xK9q
```

Watch the click counter rise:

```sql
select code, clicks, long_url from urls order by created_at desc;
```

## ☁️ Deploy

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step Vercel + Supabase instructions.

## 📚 What I learned building this

- The **Server vs. Client Component** boundary in the Next.js App Router.
- Writing backend **Route Handlers** with the web `Request`/`Response` API.
- Next.js 16's async `params`/`searchParams` breaking change.
- Why **302 (not 301)** redirects keep click analytics accurate.
- Doing an **atomic** read-increment-return in a single SQL function to avoid race conditions.
- Keeping secrets server-side and initializing clients **lazily** for serverless.

> Started life as a plain Express + local Postgres app (see `legacy/`) and was
> rebuilt into this Next.js + Supabase stack — the git history shows the journey.
