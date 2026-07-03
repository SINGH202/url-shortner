// utils.ts — pure helper functions with no knowledge of the database or the
// network. Keeping them here (and free of side effects) makes them trivial to
// reason about and to reuse from any route handler.

// The alphabet for our short codes: A–Z, a–z, 0–9 => 62 possible characters.
// This is called "base62" — it packs the most identifiers into the fewest
// URL-safe characters (no +, /, or = that you'd get from base64).
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a random short code, e.g. "aB3xK9q".
 *
 * WHY crypto instead of Math.random():
 * Math.random() is a *predictable* pseudo-random generator — given enough
 * outputs, an attacker can guess future codes and enumerate everyone's links.
 * crypto.getRandomValues() is cryptographically secure. We use the Web Crypto
 * API (a global) rather than Node's `crypto` module so this same code runs on
 * both the Node.js and Edge runtimes without changes.
 *
 * With 62^7 ≈ 3.5 trillion combinations, collisions are extremely rare — and
 * the UNIQUE constraint in the database is our hard backstop if one ever hits.
 */
export function generateCode(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < length; i++) {
    // Map each random byte (0–255) onto an index in our 62-char alphabet.
    // Note: 256 isn't a clean multiple of 62, so the first few characters are
    // very slightly more likely — a negligible bias for short-link IDs.
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

// Slugs a visitor is NOT allowed to claim, because they'd shadow (or be
// confused with) real routes in the app — both today's and the ones Phase 2
// will add. The [code] route only matches paths that aren't already a real
// route, but blocking these keeps custom links unambiguous.
const RESERVED_SLUGS = new Set([
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  // Reserved ahead of Phase 2 (auth + dashboard) so a claimed slug can never
  // collide with those pages later.
  "login",
  "logout",
  "signup",
  "auth",
  "dashboard",
  "account",
  "settings",
]);

/**
 * Has a link's expiry passed? NULL expiry = never expires = never expired.
 *
 * Kept here (a plain module, not a React component) so the current-time read
 * lives outside render — components can call this without tripping React's
 * purity rule.
 */
export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Validate a user-supplied custom slug.
 *
 * Rules:
 *   • 3–16 characters (fits the `code VARCHAR(16)` column)
 *   • only URL-safe characters: letters, digits, hyphen, underscore
 *   • not one of our reserved words (checked case-insensitively)
 *
 * We intentionally forbid dots and slashes so a slug can't smuggle in a path
 * or a file extension.
 */
export function isValidSlug(value: string): boolean {
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(value)) return false;
  if (RESERVED_SLUGS.has(value.toLowerCase())) return false;
  return true;
}

/**
 * Sanitise a caller-supplied "where to go next" value into a SAFE local path.
 *
 * Post-login and post-callback redirects take their destination from the URL
 * (?redirect=… / ?next=…), which is fully attacker-controlled. Passing that
 * straight to a navigation turns our own auth pages into an open redirect — a
 * phishing vector (send a victim to /login?redirect=https://evil.com, they sign
 * in, we bounce them to the attacker). We only accept a value that starts with
 * a single "/" and NOT "//" (the latter is a protocol-relative URL like
 * "//evil.com" that browsers treat as absolute). Anything else → the fallback.
 */
export function safeInternalPath(
  target: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (target && /^\/(?!\/)/.test(target)) return target;
  return fallback;
}

/**
 * Validate that a string is a real http(s) URL before we store it.
 *
 * We deliberately allow ONLY http and https. Without this check, someone could
 * shorten `javascript:...` or `data:...` URLs and turn your shortener into a
 * tool for delivering malicious links — a classic "open redirect" abuse.
 */
export function isValidUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // `new URL()` throws on anything that isn't a well-formed absolute URL.
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
