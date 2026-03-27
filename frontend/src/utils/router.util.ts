export function safeRedirectPath(path: string | undefined) {
  if (!path) return "/";

  if (!path.startsWith("/")) return "/";

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return "/";

  return path;
}
