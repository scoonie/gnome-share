import { NextRequest, NextResponse } from "next/server";
import configService from "./services/config.service";
import Config from "./types/config.type";

// This proxy redirects based on different conditions:
// - Authentication state
// - Setup status
// - Admin privileges

export const config = {
  matcher: "/((?!api|static|.*\\..*|_next).*)",
};

// In-memory cache for the backend `/api/configs` response. The proxy runs on
// every page navigation, and without this cache each navigation issues a
// fresh backend request (which is significant load behind a reverse proxy
// like Traefik). The TTL is intentionally short so admin config changes
// still propagate quickly.
const CONFIG_CACHE_TTL_MS = (() => {
  const raw = process.env.PROXY_CONFIG_CACHE_TTL_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30_000;
})();
let cachedConfig: { value: Config[]; expiresAt: number } | null = null;
let inflightConfig: Promise<Config[]> | null = null;

type ProxyUser = { isAdmin: boolean };

async function getBackendConfig(apiUrl: string): Promise<Config[]> {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.value;
  }
  if (inflightConfig) {
    return inflightConfig;
  }
  inflightConfig = (async () => {
    try {
      const response = await fetch(`${apiUrl}/api/configs`);
      if (!response.ok) {
        throw new Error(`Backend /api/configs returned ${response.status}`);
      }
      const value = (await response.json()) as Config[];
      if (CONFIG_CACHE_TTL_MS > 0) {
        cachedConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
      }
      return value;
    } finally {
      inflightConfig = null;
    }
  })();
  return inflightConfig;
}

async function getCurrentUser(
  apiUrl: string,
  cookieHeader: string | null,
): Promise<ProxyUser | null> {
  if (!cookieHeader) return null;

  const response = await fetch(`${apiUrl}/api/users/me`, {
    headers: { cookie: cookieHeader },
  });
  if (!response.ok) return null;
  return (await response.json()) as ProxyUser;
}

type RouteGroups = {
  unauthenticated: Routes;
  public: Routes;
  admin: Routes;
  account: Routes;
  disabled: Routes;
};

function routeNeedsUser(route: string, routes: RouteGroups) {
  if (routes.disabled.contains(route)) {
    return false;
  }

  if (routes.admin.contains(route) || routes.account.contains(route)) {
    return true;
  }

  if (route === "/") {
    return true;
  }

  return !routes.public.contains(route);
}

export async function proxy(request: NextRequest) {
  const routes: RouteGroups = {
    unauthenticated: new Routes(["/auth/*", "/"]),
    public: new Routes([
      "/share/*",
      "/s/*",
      "/upload/*",
      "/error",
      "/imprint",
      "/privacy",
    ]),
    admin: new Routes(["/admin/*"]),
    account: new Routes(["/account*"]),
    disabled: new Routes([]),
  };

  // Get config from backend (cached in-process to avoid issuing a backend
  // request on every page navigation).
  const apiUrl = process.env.API_URL || "http://localhost:8080";
  const backendConfig = await getBackendConfig(apiUrl);

  const getConfig = (key: string) => {
    return configService.get(key, backendConfig);
  };

  const route = request.nextUrl.pathname;

  if (!getConfig("share.allowRegistration")) {
    routes.disabled.push("/auth/signUp");
  }

  if (getConfig("share.allowUnauthenticatedShares")) {
    routes.public = new Routes(["*"]);
  }

  if (!getConfig("smtp.enabled")) {
    routes.disabled.push("/auth/resetPassword*");
  }

  if (!getConfig("legal.enabled")) {
    routes.disabled.push("/imprint", "/privacy");
  } else {
    if (!getConfig("legal.imprintText") && !getConfig("legal.imprintUrl")) {
      routes.disabled.push("/imprint");
    }
    if (
      !getConfig("legal.privacyPolicyText") &&
      !getConfig("legal.privacyPolicyUrl")
    ) {
      routes.disabled.push("/privacy");
    }
  }

  const user = routeNeedsUser(route, routes)
    ? await getCurrentUser(apiUrl, request.headers.get("cookie"))
    : null;

  // prettier-ignore
  const rules = [
    // Disabled routes
    {
      condition: routes.disabled.contains(route),
      path: "/",
    },
     // Authenticated state
     {
      condition: user && routes.unauthenticated.contains(route) && !getConfig("share.allowUnauthenticatedShares"),
      path: "/upload",
    },
    // Unauthenticated state
    {
      condition: !user && !routes.public.contains(route) && !routes.unauthenticated.contains(route),
      path: "/auth/signIn",
    },
    {
      condition: !user && routes.account.contains(route),
      path: "/upload",
    },
    // Admin privileges
    {
      condition: routes.admin.contains(route) && !user?.isAdmin,
      path: "/upload",
    },
    // Home page
    {
      condition: (!getConfig("general.showHomePage") || user) && route == "/",
      path: "/upload",
    },
    // Imprint redirect
    {
      condition: route == "/imprint" && !getConfig("legal.imprintText") && getConfig("legal.imprintUrl"),
      path: getConfig("legal.imprintUrl"),
    },
    // Privacy redirect
    {
      condition: route == "/privacy" && !getConfig("legal.privacyPolicyText") && getConfig("legal.privacyPolicyUrl"),
      path: getConfig("legal.privacyPolicyUrl"),
    },
  ];
  for (const rule of rules) {
    if (rule.condition) {
      let { path } = rule;

      if (path == "/auth/signIn") {
        path = path + "?redirect=" + encodeURIComponent(route);
      }
      return NextResponse.redirect(new URL(path, request.url));
    }
  }
}

// Helper class to check if a route matches a list of routes
class Routes {
  private patterns: RegExp[];

  constructor(public routes: string[]) {
    this.patterns = routes.map((route) => Routes.toPattern(route));
  }

  push(...routes: string[]) {
    this.routes.push(...routes);
    this.patterns.push(...routes.map((route) => Routes.toPattern(route)));
  }

  contains(_route: string) {
    for (const pattern of this.patterns) {
      if (pattern.test(_route)) return true;
    }
    return false;
  }

  private static toPattern(route: string) {
    return new RegExp("^" + route.replace(/\*/g, ".*") + "$");
  }
}
