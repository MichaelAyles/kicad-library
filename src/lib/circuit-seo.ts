/**
 * SEO fields for a circuit page, shared by generateMetadata and the page's
 * JSON-LD so both describe the circuit identically.
 */

import { toR2ThumbnailUrl } from "@/lib/thumbnail-url";
import { circuitUrl } from "@/lib/site";
import type { CircuitView } from "@/lib/public-circuits";

const DESCRIPTION_MAX = 160;

/**
 * Reduce a markdown description to plain text for a meta description.
 *
 * Only strips real markdown/HTML syntax, so electronics text survives:
 * "Vin < 30V, Iout > 1A", "LM317_ADJ", "~5%", "R*C" and "5 * 3" are kept.
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // Fenced code blocks
      .replace(/```[\s\S]*?```/g, " ")
      // Images -> alt text, links -> link text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // HTML tags: "<" must be followed by a tag name
      .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
      // Line-leading headings, blockquotes and list markers
      .replace(/^[ \t]{0,3}(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, "")
      // Inline code
      .replace(/`([^`\n]+)`/g, "$1")
      // Emphasis, only when the markers wrap text:
      // **bold** (may be intraword), __bold__ and _it_ (word boundaries),
      // *it* (not touching word chars outside), ~~strike~~
      .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "$1")
      .replace(/(^|[^\w])__(?=\S)([^\n]*?\S)__(?!\w)/g, "$1$2")
      .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, "$1$2")
      .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, "$1$2")
      .replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Truncate at a word boundary, adding an ellipsis if shortened. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface CircuitSeo {
  url: string;
  /** Full document title, including the site name */
  pageTitle: string;
  description: string;
  /** Preview image (R2 thumbnail), or null if the circuit has none */
  image: string | null;
  author: string | null;
}

export function getCircuitSeo(
  circuit: Pick<
    CircuitView,
    | "slug"
    | "title"
    | "description"
    | "thumbnail_light_url"
    | "thumbnail_dark_url"
    | "github_owner"
    | "user"
  >,
): CircuitSeo {
  const text = toPlainText(circuit.description);
  return {
    url: circuitUrl(circuit.slug),
    pageTitle: `${circuit.title} - KiCad Schematic | CircuitSnips`,
    description: truncate(
      text ||
        `${circuit.title}: a reusable KiCad schematic subcircuit on CircuitSnips.`,
      DESCRIPTION_MAX,
    ),
    // Light thumbnails read better in link previews; fall back to dark.
    // toR2ThumbnailUrl maps legacy Supabase Storage URLs to R2.
    image:
      toR2ThumbnailUrl(circuit.thumbnail_light_url) ||
      toR2ThumbnailUrl(circuit.thumbnail_dark_url),
    author: circuit.github_owner || circuit.user?.username || null,
  };
}
