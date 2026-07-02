// env.ts — small helpers for reading server-side environment flags.

/** True when IS_DEV / NEXT_PUBLIC_IS_DEV is set to "true" or "1". */
export function isDev(): boolean {
  const value = process.env.IS_DEV ?? process.env.NEXT_PUBLIC_IS_DEV;
  return value === "true" || value === "1";
}
