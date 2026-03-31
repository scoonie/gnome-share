export function safeRedirectPath(path: string | string[] | undefined, fallback: string = "/") {
  // Next.js query params can be string | string[] | undefined
  if (Array.isArray(path)) {
    path = path[0];
  }

  if (!path || typeof path !== "string") return fallback;

  if (!path.startsWith("/")) return fallback;

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return fallback;

  // At this point, we have an internal path starting with a single "/"
  // and not a protocol-relative URL. Treat it as safe.
  return path;
}