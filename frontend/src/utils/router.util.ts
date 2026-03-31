export function safeRedirectPath(path: string | undefined, fallback: string = "/") {
  if (!path) return fallback;

  if (!path.startsWith("/")) return fallback;

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return fallback;

  return path;
}
