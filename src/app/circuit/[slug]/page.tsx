import type { Metadata } from "next";
import { getPublicCircuitPage } from "@/lib/public-circuits";
import { toR2ThumbnailUrl } from "@/lib/thumbnail-url";
import { SITE_URL } from "@/lib/site";
import { CircuitDetail } from "./CircuitDetail";

/**
 * Circuit detail page.
 *
 * Public circuits are fetched and rendered on the server (cookie-less client,
 * so the HTML is the same for everyone) and cached with ISR: each slug renders
 * on first request (generateStaticParams in layout.tsx returns []) and is
 * regenerated at most hourly, or immediately when the owner edits or deletes it
 * (revalidatePath in /api/circuits/[id]).
 *
 * If no public circuit matches, the page renders the client component with no
 * initial data and it loads the circuit in the browser, so owners can still
 * open their private circuits. That fallback is marked noindex.
 */
export const revalidate = 3600;

type PageProps = { params: { slug: string } };

const DESCRIPTION_MAX = 160;

/** Reduce markdown to plain text suitable for a meta description. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, lists
    .replace(/[*_~`]+/g, "") // emphasis, inline code
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function circuitDescription(title: string, description: string): string {
  const text = toPlainText(description);
  return truncate(
    text || `${title}: a reusable KiCad schematic subcircuit on CircuitSnips.`,
    DESCRIPTION_MAX,
  );
}

function authorName(circuit: {
  github_owner: string | null;
  user?: { username: string };
}): string | null {
  return circuit.github_owner || circuit.user?.username || null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const page = await getPublicCircuitPage(params.slug);

  if (!page) {
    // Unknown slug or a private circuit (rendered client-side for its owner)
    return {
      title: "Circuit - CircuitSnips",
      robots: { index: false, follow: false },
    };
  }

  const { circuit } = page;
  const url = `${SITE_URL}/circuit/${circuit.slug}`;
  const title = `${circuit.title} - KiCad Schematic | CircuitSnips`;
  const description = circuitDescription(circuit.title, circuit.description);
  // Light thumbnails read better in link previews; fall back to dark
  const image =
    toR2ThumbnailUrl(circuit.thumbnail_light_url) ||
    toR2ThumbnailUrl(circuit.thumbnail_dark_url);
  const images = image
    ? [{ url: image, alt: `${circuit.title} schematic` }]
    : undefined;
  const author = authorName(circuit);

  return {
    title,
    description,
    keywords: circuit.tags,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "CircuitSnips",
      title: circuit.title,
      description,
      images,
      publishedTime: circuit.created_at,
      modifiedTime: circuit.updated_at,
      authors: author ? [author] : undefined,
      tags: circuit.tags,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: circuit.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CircuitPage({ params }: PageProps) {
  const page = await getPublicCircuitPage(params.slug);

  if (!page) {
    return (
      <CircuitDetail
        slug={params.slug}
        initialCircuit={null}
        initialParts={null}
      />
    );
  }

  const { circuit, parts } = page;
  const author = authorName(circuit);
  const image =
    toR2ThumbnailUrl(circuit.thumbnail_light_url) ||
    toR2ThumbnailUrl(circuit.thumbnail_dark_url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: circuit.title,
    description: circuitDescription(circuit.title, circuit.description),
    url: `${SITE_URL}/circuit/${circuit.slug}`,
    image: image || undefined,
    keywords: circuit.tags.join(", "),
    license: circuit.license,
    dateCreated: circuit.created_at,
    dateModified: circuit.updated_at,
    author: author ? { "@type": "Person", name: author } : undefined,
    encodingFormat: "application/x-kicad-schematic",
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so user text can't close the script tag
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <CircuitDetail
        slug={circuit.slug}
        initialCircuit={circuit}
        initialParts={parts}
      />
    </>
  );
}
