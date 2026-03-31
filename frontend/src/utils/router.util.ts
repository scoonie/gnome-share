export function safeRedirectPath(
  path: string | string[] | undefined,
  fallback: string = "/",
): string {
  // Next.js query params can be string | string[] | undefined
  if (Array.isArray(path)) {
    path = path[0];
  }

  if (!path || typeof path !== "string") return fallback;

  // Trim whitespace and normalise backslashes so that "/\evil.com" becomes "//evil.com"
  // which is then caught by the protocol-relative check below.
  path = path.trim().replace(/\\/g, "/");

  // Block dangerous URI schemes (defense-in-depth — these would also fail the
  // startsWith("/") check, but being explicit makes the intent clear).
  if (/^[a-z][a-z0-9+\-.]*:/i.test(path)) return fallback;

  // Must be a root-relative path
  if (!path.startsWith("/")) return fallback;

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return fallback;

  // Final origin check: resolve the path against a dummy origin and ensure the
  // host hasn't changed, which catches creative encoding tricks.
  try {
    const dummy = "http://localhost";
    const resolved = new URL(path, dummy);
    if (resolved.origin !== dummy) return fallback;
  } catch {
    return fallback;
  }

  return path;
}