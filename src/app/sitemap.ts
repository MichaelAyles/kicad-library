import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site";

// Regenerate at most once a day
export const revalidate = 86400;

// PostgREST returns at most 1000 rows per request
const PAGE_SIZE = 1000;

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

async function getPublicCircuitEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();
  const entries: MetadataRoute.Sitemap = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("circuits")
      .select("slug, updated_at")
      .eq("is_public", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Sitemap query failed: ${error.message}`);

    for (const row of data ?? []) {
      entries.push({
        url: `${SITE_URL}/circuit/${encodeURIComponent(row.slug)}`,
        lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }

    if (!data || data.length < PAGE_SIZE) break;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  let circuitEntries: MetadataRoute.Sitemap = [];
  try {
    circuitEntries = await getPublicCircuitEntries();
  } catch (err) {
    // Don't fail the build over the sitemap; serve the static pages instead
    console.error("Failed to list circuits for sitemap:", err);
  }

  return [...staticEntries, ...circuitEntries];
}
