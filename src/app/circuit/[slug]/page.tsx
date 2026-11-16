import type { Metadata } from "next";
import {
  getPublicCircuitPage,
  listCircuitSlugsForBuild,
} from "@/lib/public-circuits";
import { SHELL_SLUG } from "@/lib/shell-slug";
import { getCircuitSeo } from "@/lib/circuit-seo";
import { CircuitDetail } from "./CircuitDetail";

/**
 * Circuit detail page.
 *
 * The site is a static export. Every public circuit gets its own page at build
 * time, with full metadata, Open Graph tags and JSON-LD, and the browser
 * refreshes the circuit's fields and counters on load.
 *
 * One extra page is built for SHELL_SLUG. The worker serves it for any other
 * /circuit/<slug>: circuits created or made public since the last build, and
 * private circuits. It loads the circuit in the browser and is marked noindex.
 * A scheduled rebuild picks new public circuits up (see worker/assets.ts).
 */
export async function generateStaticParams() {
  const circuits = await listCircuitSlugsForBuild();
  return [...circuits.map(({ slug }) => ({ slug })), { slug: SHELL_SLUG }];
}

export const dynamicParams = false;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page =
    params.slug === SHELL_SLUG ? null : await getPublicCircuitPage(params.slug);

  if (!page) {
    // Unknown slug or a private circuit (rendered client-side for its owner)
    return {
      title: "Circuit - CircuitSnips",
      robots: { index: false, follow: false },
    };
  }

  const { circuit } = page;
  const { url, pageTitle, description, image, author } = getCircuitSeo(circuit);
  const images = image
    ? [{ url: image, alt: `${circuit.title} schematic` }]
    : undefined;

  return {
    title: pageTitle,
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

export default async function CircuitPage(props: PageProps) {
  const params = await props.params;
  const page =
    params.slug === SHELL_SLUG ? null : await getPublicCircuitPage(params.slug);

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
  const { url, description, image, author } = getCircuitSeo(circuit);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: circuit.title,
    description,
    url,
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
