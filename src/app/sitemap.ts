import type { MetadataRoute } from "next";
import { listCircuitSlugsForBuild } from "@/lib/public-circuits";
import { SITE_URL, circuitUrl } from "@/lib/site";

// Built with the site (static export); the scheduled rebuild keeps it fresh
export const dynamic = "force-static";

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
 * Lists the same public circuits as the pre-built circuit pages. A database
 * error fails the build rather than shipping a partial sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const circuits = await listCircuitSlugsForBuild();

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
