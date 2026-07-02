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
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- When the short link stops working. NULL = "never expires" (the default,
    -- and how every existing row behaves). We store an absolute instant rather
    -- than a duration so the check is a trivial `expires_at > now()`.
    expires_at  TIMESTAMPTZ,

    -- Who owns this link (Phase 2). References the Supabase Auth user table.
    -- NULL = a legacy anonymous link created before login was required; those
    -- still resolve, they just don't appear in anyone's dashboard. New links
    -- MUST have an owner — enforced by the INSERT policy below, not a NOT NULL
    -- constraint (so pre-existing anonymous rows don't block this migration).
    user_id     UUID REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Bring existing databases up to date without touching rows already present.
ALTER TABLE urls ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE urls ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users (id) ON DELETE CASCADE;

-- Fast "show me my links" lookups for the dashboard.
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);

-- An index makes "find the row WHERE code = ?" fast even with millions of rows.
-- (The UNIQUE constraint above already creates one, but being explicit is good learning.)
CREATE INDEX IF NOT EXISTS idx_urls_code ON urls (code);

-- RLS: clients (using the publishable key) can only do what these policies
-- allow. Phase 2 moves from "anyone can do anything" to "you can only touch
-- your own links."
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;

-- Remove the old permissive anonymous policies from Phase 1.
DROP POLICY IF EXISTS "anon can insert urls" ON urls;
DROP POLICY IF EXISTS "anon can update urls" ON urls;

-- A signed-in user may create links, but only ones they own. For an anonymous
-- (unauthenticated) request auth.uid() is NULL, so this check fails — which is
-- how "login required to shorten" is enforced at the database level. The app
-- also returns a friendly 401 before it ever reaches here.
DROP POLICY IF EXISTS "users insert own urls" ON urls;
CREATE POLICY "users insert own urls"
  ON urls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- A user may read, update, and delete only their own links (the dashboard).
DROP POLICY IF EXISTS "users select own urls" ON urls;
CREATE POLICY "users select own urls"
  ON urls FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own urls" ON urls;
CREATE POLICY "users update own urls"
  ON urls FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own urls" ON urls;
CREATE POLICY "users delete own urls"
  ON urls FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Note: there is deliberately NO anonymous SELECT/UPDATE policy. The public
-- redirect path never queries this table directly — it goes exclusively
-- through the SECURITY DEFINER resolve_and_click() function below, which
-- bypasses RLS. That keeps redirects working for everyone while private link
-- data stays owner-only.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON urls TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


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
-- ---------------------------------------------------------------------------
-- Analytics (Phase 3): one row per click, so we can chart clicks over time and
-- break down traffic by referrer. The aggregate `clicks` counter on `urls`
-- stays as a fast total; this table is the detailed event log behind it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS click_events (
    id          BIGSERIAL PRIMARY KEY,
    -- Which link was clicked. CASCADE so deleting a link cleans up its events.
    url_id      BIGINT NOT NULL REFERENCES urls (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Where the click came from (Referer header), the visitor's country
    -- (Vercel's x-vercel-ip-country header), and their user agent. All nullable
    -- because none are guaranteed to be present.
    referrer    TEXT,
    country     TEXT,
    user_agent  TEXT
);

-- Fast "all events for this link, newest first" queries for the analytics page.
CREATE INDEX IF NOT EXISTS idx_click_events_url_created
    ON click_events (url_id, created_at);

ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;

-- A user may read click events only for links they own. Inserts are NOT granted
-- to any client role — they happen exclusively through the SECURITY DEFINER
-- resolve_and_click() function below, so anonymous visitors can be recorded
-- without being able to read or forge analytics.
DROP POLICY IF EXISTS "users select own click_events" ON click_events;
CREATE POLICY "users select own click_events"
  ON click_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM urls
       WHERE urls.id = click_events.url_id
         AND urls.user_id = auth.uid()
    )
  );

GRANT SELECT ON click_events TO authenticated;


-- resolve_and_click(): the heart of the redirect, done in ONE atomic database
-- call. It increments the aggregate counter, records a detailed click event,
-- and returns the destination URL — all in a single round-trip.
--
-- SECURITY DEFINER: with per-user RLS on `urls` (Phase 2) an anonymous visitor
-- has no rights to UPDATE `urls` or INSERT into `click_events`. Running with the
-- owner's rights lets the public redirect record analytics for any link while
-- private data stays locked behind RLS everywhere else.
--
-- Drop the older 1-argument version first so we don't leave an ambiguous
-- overload behind on databases created in Phase 1/2.
DROP FUNCTION IF EXISTS resolve_and_click(TEXT);

CREATE OR REPLACE FUNCTION resolve_and_click(
    p_code        TEXT,
    p_referrer    TEXT DEFAULT NULL,
    p_country     TEXT DEFAULT NULL,
    p_user_agent  TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id       urls.id%TYPE;
    v_long_url urls.long_url%TYPE;
BEGIN
    -- Only resolve links that exist AND haven't expired. An expired/absent row
    -- returns nothing (NULL) — the redirect route then sends the visitor to
    -- /?notfound=1, same as a code that never existed.
    UPDATE urls
       SET clicks = clicks + 1
     WHERE code = p_code
       AND (expires_at IS NULL OR expires_at > now())
 RETURNING id, long_url INTO v_id, v_long_url;

    IF v_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Record the detailed event when analytics is set up. Never block a redirect
    -- if click_events is missing or insert fails (e.g. partial schema migration).
    BEGIN
        INSERT INTO click_events (url_id, referrer, country, user_agent)
        VALUES (v_id, p_referrer, p_country, p_user_agent);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN v_long_url;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_and_click(TEXT, TEXT, TEXT, TEXT)
    TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- Rate limiting (Postgres-backed, so it works on Vercel's stateless serverless
-- functions where an in-memory counter would not survive between invocations).
-- ---------------------------------------------------------------------------

-- One row per request we've seen recently, keyed by client IP. Old rows are
-- pruned inside the function below on each call, so this table stays small.
CREATE TABLE IF NOT EXISTS rate_limits (
    ip          TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Makes "count this IP's requests in the last N seconds" fast.
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created
    ON rate_limits (ip, created_at);

-- RLS on, with NO policies and NO grants to anon: clients can never read or
-- write this table directly. Only the SECURITY DEFINER function below touches
-- it, running with the table owner's rights.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- check_rate_limit(): records the current request and reports whether this IP
-- is still under its budget. SECURITY DEFINER lets the anon caller run it even
-- though anon has no direct access to the rate_limits table.
--
--   p_ip           the client IP (from the x-forwarded-for header)
--   p_max          max requests allowed within the window
--   p_window_secs  the sliding window length, in seconds
--
-- Returns TRUE if the request is allowed, FALSE if the IP is over the limit.
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_ip           TEXT,
    p_max          INT,
    p_window_secs  INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT;
BEGIN
    -- Prune this IP's stale rows so the table doesn't grow unbounded.
    DELETE FROM rate_limits
     WHERE ip = p_ip
       AND created_at < now() - make_interval(secs => p_window_secs);

    -- Record this attempt, then count how many are in the window.
    INSERT INTO rate_limits (ip) VALUES (p_ip);

    SELECT count(*) INTO v_count
      FROM rate_limits
     WHERE ip = p_ip
       AND created_at > now() - make_interval(secs => p_window_secs);

    RETURN v_count <= p_max;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) TO anon, authenticated;
