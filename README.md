# 🔗 URL Shortener

A fast, production-style URL shortener built with **Node.js**, **Express**, and **PostgreSQL** — turns long links into short, shareable codes and tracks click counts.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

> **🌐 Live demo:** _add your Render URL here after deploying_ →  `https://<your-app>.onrender.com`

<!-- Tip: record a short GIF of shortening + redirecting and drop it here.
     A picture of it working is the single best thing on a portfolio repo. -->
<!-- ![demo](docs/demo.gif) -->

## ✨ Features

- **Shorten any URL** into a 6-character base62 code (62⁶ ≈ 56.8 billion combinations).
- **Cryptographically secure codes** via `crypto.randomBytes` — unguessable, no bias.
- **302 redirects** so every click routes through the server (enabling analytics).
- **Click tracking** with an atomic `UPDATE ... RETURNING` (no race conditions).
- **SQL-injection safe** — all queries are parameterized.
- **Input validation** — rejects anything that isn't a valid http(s) URL.
- **Deploy-ready** — reads config from environment variables and self-initializes its schema.

## 🧱 Tech stack & architecture

```
Client ──POST /shorten {url}──►  Express  ──► generate base62 code ──► INSERT ──► PostgreSQL
Client ──GET  /:code──────────►  Express  ──► UPDATE clicks +1, fetch url ──► 302 redirect
```

| File | Responsibility |
|------|----------------|
| `server.js`  | Express app: routes, code generation, validation |
| `db.js`      | Postgres connection pool + schema bootstrap |
| `schema.sql` | `urls` table definition |

## 🚀 Getting started (local)

**Prerequisites:** Node 18+, PostgreSQL running locally.

```bash
# 1. Clone and install
git clone https://github.com/<you>/url-shortner.git
cd url-shortner
npm install

# 2. Configure environment
cp .env.example .env        # then edit if your Postgres differs

# 3. Create the database (the table is created automatically on first run)
createdb urlshortener

# 4. Start
npm start                   # -> http://localhost:3000
```

## 📡 API

| Method | Route          | Body                | Description                          |
|--------|----------------|---------------------|--------------------------------------|
| `POST` | `/shorten`     | `{ "url": "..." }`  | Create a short link                  |
| `GET`  | `/:code`       | –                   | Redirect (302) to the original URL   |
| `GET`  | `/health`      | –                   | Health check (`{ "status": "ok" }`)  |

**Example**

```bash
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://developer.mozilla.org"}'
# { "shortUrl": "http://localhost:3000/aB3xY9", "code": "aB3xY9", ... }
```

## ☁️ Deployment

Deployed on [Render](https://render.com) with a managed PostgreSQL instance.
The app reads `DATABASE_URL`, `BASE_URL`, and `PORT` from the environment and
creates its table automatically on boot. See `DEPLOY.md` for step-by-step instructions.

## 🛣️ Roadmap / possible extensions

- [ ] Web UI with a form and copy-to-clipboard
- [ ] Custom aliases (`/my-link`)
- [ ] Link expiry dates
- [ ] `GET /:code/stats` analytics endpoint
- [ ] Rate limiting

## 📄 License

ISC
