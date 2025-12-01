import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  RateLimitPresets,
  type RateLimitConfig,
} from "@/lib/rate-limit";

/**
 * Middleware to:
 * 1. Apply rate limiting to API routes
 * 2. Refresh Supabase auth tokens
 *
 * Runs on every request to keep user sessions valid and prevent abuse
 */
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

  // Refresh session if expired
  await supabase.auth.getUser();

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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
