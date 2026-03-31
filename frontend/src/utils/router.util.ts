export function safeRedirectPath(path: string | undefined, fallback: string = "/") {
  if (!path) return fallback;

  if (!path.startsWith("/")) return fallback;

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return fallback;

  // Allowlist of safe redirect destinations. Extend this as needed.
  const allowedRedirects = ["/", "/upload"];

  if (allowedRedirects.includes(path)) {
    return path;
  }

  // If the requested path is not explicitly allowed, fall back.
  return fallback;
}
