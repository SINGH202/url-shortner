-- schema.sql — production database setup for Snip URL shortener.
-- Run once in Supabase SQL Editor (safe to re-run: uses IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS urls (
    -- A surrogate primary key. BIGSERIAL = auto-incrementing big integer.
    id          BIGSERIAL PRIMARY KEY,

    -- The short code. UNIQUE means the database itself forbids duplicates —
    -- a second safety net beneath our JavaScript collision check.
    code        VARCHAR(16) NOT NULL UNIQUE,

    -- The original URL. TEXT has no length limit, unlike VARCHAR(n).
    long_url    TEXT NOT NULL,

    -- How many times the short link has been visited.
    clicks      INTEGER NOT NULL DEFAULT 0,

    -- When the row was created. Defaults to "right now" on insert.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An index makes "find the row WHERE code = ?" fast even with millions of rows.
-- (The UNIQUE constraint above already creates one, but being explicit is good learning.)
CREATE INDEX IF NOT EXISTS idx_urls_code ON urls (code);

-- RLS: the publishable (anon) key can only do what these policies allow.
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon can insert urls" ON urls;
CREATE POLICY "anon can insert urls"
  ON urls FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon can update urls" ON urls;
CREATE POLICY "anon can update urls"
  ON urls FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT, UPDATE ON urls TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;


-- resolve_and_click(): the heart of the redirect, done in ONE atomic database call.
--
-- Why a database function instead of "SELECT, then UPDATE" from JavaScript?
-- If two people click the same link at the same instant, a read-then-write in
-- app code can lose an increment (both read clicks=5, both write 6). Doing the
-- UPDATE ... RETURNING inside the database makes the increment atomic — no lost
-- clicks, and only a single network round-trip from our serverless function.
--
-- It returns the long_url so the same call both records the click AND tells us
-- where to redirect. If the code doesn't exist, it returns nothing (NULL).
CREATE OR REPLACE FUNCTION resolve_and_click(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
    UPDATE urls
       SET clicks = clicks + 1
     WHERE code = p_code
 RETURNING long_url;
$$;

GRANT EXECUTE ON FUNCTION resolve_and_click(TEXT) TO anon;
