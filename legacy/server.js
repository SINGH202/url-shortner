// server.js — URL shortener (Node + Express + PostgreSQL)

import dotenv from "dotenv";

dotenv.config(); // load variables from .env into process.env

import crypto from "node:crypto";
import express from "express";
import db from "./db";

const app = express();
const PORT = process.env.PORT || 3000;
// The public base used to build short links. Falls back to localhost for dev.
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());

// -------------------------------------------------------------------------
// SHORT-CODE GENERATOR — base62, using a CRYPTOGRAPHICALLY SECURE source.
// Unlike Math.random(), crypto.randomBytes() output can't be predicted, so
// codes can't be guessed by an attacker who has seen a few of them.
// -------------------------------------------------------------------------
const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 6;

function generateCode(length = CODE_LENGTH) {
  let code = "";
  while (code.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (code.length >= length) break;
      // 248 = 62 * 4, the largest multiple of 62 that fits in a byte.
      // Rejecting bytes >= 248 keeps every letter equally likely (no bias).
      if (byte < 248) code += ALPHABET[byte % 62];
    }
  }
  return code;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------
// Landing route — a friendly message so the deployed root URL isn't a 404.
// -------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send(
    "URL Shortener API is running. POST JSON { url } to /shorten to create a short link."
  );
});

// Health check — deploy platforms ping this to confirm the app is alive.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// -------------------------------------------------------------------------
// POST /shorten  — { "url": "https://..." }  ->  { shortUrl, code }
// -------------------------------------------------------------------------
app.post("/shorten", async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Please provide a valid http(s) URL" });
  }

  // Try to insert; retry on the rare chance of a code collision.
  // The database's UNIQUE constraint (error code 23505) is our source of truth.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      // $1, $2 are PARAMETERIZED placeholders — the pg driver substitutes them
      // safely, so a malicious URL can never inject SQL.
      await db.query("INSERT INTO urls (code, long_url) VALUES ($1, $2)", [
        code,
        url,
      ]);
      return res.json({ shortUrl: `${BASE_URL}/${code}`, code, longUrl: url });
    } catch (err) {
      if (err.code === "23505") continue; // duplicate code -> retry
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
  }
  res.status(500).json({ error: "Could not generate a unique code, try again" });
});

// -------------------------------------------------------------------------
// GET /:code  — count the click and redirect to the original URL.
// -------------------------------------------------------------------------
app.get("/:code", async (req, res) => {
  try {
    // Atomically increment clicks AND return the URL in one statement.
    const result = await db.query(
      "UPDATE urls SET clicks = clicks + 1 WHERE code = $1 RETURNING long_url",
      [req.params.code]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Short URL not found");
    }
    res.redirect(302, result.rows[0].long_url);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Ensure the table exists, THEN start listening.
db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on ${BASE_URL}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
