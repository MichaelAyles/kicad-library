import type { MetadataRoute } from "next";
import { listPublicCircuitSlugs } from "@/lib/public-circuits";
import { SITE_URL, circuitUrl } from "@/lib/site";

// Regenerate at most once a day
export const revalidate = 86400;

const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/browse", changeFrequency: "daily", priority: 0.9 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.7 },
  { path: "/docs", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

/**
 * Query errors propagate on purpose: during ISR revalidation Next.js then
 * keeps serving the last good sitemap rather than caching a partial one.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const circuits = await listPublicCircuitSlugs();

  return [
    ...STATIC_PAGES.map((page) => ({
      url: `${SITE_URL}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...circuits.map((row) => ({
      url: circuitUrl(row.slug),
      lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
