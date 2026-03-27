export function safeRedirectPath(path: string | undefined) {
  if (!path) return "/";

  if (!path.startsWith("/")) return "/";

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (path.startsWith("//")) return "/";

  // Block javascript: and data: URIs that could be encoded in the path
  if (/^\/+[a-z]+:/i.test(path)) return "/";

  return path;
}
