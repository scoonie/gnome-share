/**
 * Sanitizes a redirect path to prevent open-redirect and XSS attacks.
 * Only allows same-origin relative paths that start with a single "/".
 * Rejects absolute URLs, protocol-relative URLs, and protocol-based URIs.
 */
export function safeRedirectPath(
  path: string | string[] | null | undefined,
  fallback: string = "/",
): string {
  // Handle arrays (e.g. from query string parsing)
  if (Array.isArray(path)) {
    path = path[0];
  }

  if (typeof path !== "string" || path.trim() === "") {
    return fallback;
  }

  const trimmed = path.trim();

  // Block protocol-relative URLs (e.g. "//evil.com")
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // Block absolute URLs and protocol-based URIs (e.g. "http:", "javascript:", etc.)
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return fallback;
  }

  // Only allow paths that start with "/"
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  return trimmed;
}
