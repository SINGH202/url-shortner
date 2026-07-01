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
