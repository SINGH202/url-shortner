-- schema.sql — defines the shape of our data.
-- Run this once to create the table.

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
