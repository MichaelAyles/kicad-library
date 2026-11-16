"use client";

import { usePathname } from "next/navigation";
import { SHELL_SLUG } from "@/lib/shell-slug";

/**
 * The circuit slug for the current page: the pre-built one, or, on the shell
 * page, the slug from the real URL (/circuit/<slug> or /circuit/<slug>/edit).
 * Null on the shell page before the URL is known.
 */
export function useRouteSlug(staticSlug: string | undefined): string | null {
  const pathname = usePathname();
  if (staticSlug && staticSlug !== SHELL_SLUG) return staticSlug;
  const match = pathname?.match(/^\/circuit\/([^/]+)/);
  const slug = match ? decodeURIComponent(match[1]) : null;
  return slug && slug !== SHELL_SLUG ? slug : null;
}
