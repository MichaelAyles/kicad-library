import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  RateLimitPresets,
  type RateLimitConfig,
} from "@/lib/rate-limit";

/**
 * Middleware for API routes only (see `config.matcher`):
 * 1. Apply rate limiting
 * 2. Refresh Supabase auth cookies for routes that act on the signed-in user
 *
 * Pages don't need it: they're client components and the browser Supabase
 * client refreshes its own session. Keeping middleware off page/asset requests
 * avoids a middleware invocation on every page view, prefetch and bot hit.
 */

// API routes that read the signed-in user and may need refreshed cookies
const AUTH_API_PREFIXES = [
  "/api/admin",
  "/api/circuits",
  "/api/upload-",
  "/api/user",
];
export async function middleware(request: NextRequest) {
  // Store rate limit result for later header addition
  let rateLimitResult = null;

  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip =
      request.ip ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const identifier = `api:${ip}`;

    // Use different limits for different endpoints
    let config: RateLimitConfig = RateLimitPresets.MODERATE; // Default: 30 req/min

    // Stricter limits for resource-intensive endpoints
    if (request.nextUrl.pathname.startsWith("/api/preview")) {
      config = RateLimitPresets.STRICT; // 10 req/10s for preview generation
    }

    rateLimitResult = checkRateLimit(identifier, config);

    if (!rateLimitResult.success) {
      return new NextResponse(
        JSON.stringify({
          error: "Too Many Requests",
          message: "You have exceeded the rate limit. Please try again later.",
          limit: rateLimitResult.limit,
          reset: new Date(rateLimitResult.reset).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            "Retry-After": Math.ceil(
              (rateLimitResult.reset - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }
  }

  // Create response for auth
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    },
  );

  const needsAuth = AUTH_API_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );
  if (needsAuth) {
    // Refresh session cookies if expired
    await supabase.auth.getUser();
  }

  // Add rate limit headers to successful API requests
  if (rateLimitResult) {
    response.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    response.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString(),
    );
    response.headers.set("X-RateLimit-Reset", rateLimitResult.reset.toString());
  }

  return response;
}

export const config = {
  // API routes only, minus the public read-only routes that are served from
  // the edge cache (middleware would otherwise run on every cached hit).
  matcher: ["/api/((?!search|stats|tags|schematic/).*)"],
};
