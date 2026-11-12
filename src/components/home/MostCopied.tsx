import Link from "next/link";
import Image from "next/image";
import type { Circuit } from "@/lib/circuits";
import { toR2ThumbnailUrl } from "@/lib/thumbnail-url";
import styles from "./home.module.css";

/**
 * Descriptions are markdown, and imported circuits open with a
 * "> **From GitHub**: [repo](url)" attribution line. For a two-line
 * card preview, drop the quote lines and markdown syntax.
 */
function plainDescription(md: string | null | undefined): string {
  if (!md) return "";
  return md
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function author(circuit: Circuit) {
  return circuit.github_owner || circuit.user?.username || null;
}

export function MostCopied({
  circuits,
  isLoading,
}: {
  circuits: Circuit[];
  isLoading: boolean;
}) {
  return (
    <section className={styles.section} aria-labelledby="top-heading">
      <div className="container mx-auto px-4">
        <div className={styles.sectionHead}>
          <h2 id="top-heading" className={styles.h2} style={{ margin: 0 }}>
            Most copied
          </h2>
          <Link href="/browse" className={styles.textLink}>
            Browse all circuits
          </Link>
        </div>

        {isLoading && (
          <div className={styles.grid} aria-busy="true">
            <p className={styles.status} style={{ gridColumn: "1 / -1" }}>
              Loading the most-copied circuits…
            </p>
          </div>
        )}

        {!isLoading && circuits.length === 0 && (
          <p className={styles.status}>
            Nothing has been published yet.{" "}
            <Link href="/upload" className={styles.textLink}>
              Upload the first circuit
            </Link>
          </p>
        )}

        {!isLoading && circuits.length > 0 && (
          <div className={styles.grid}>
            {circuits.map((circuit, i) => {
              const light = toR2ThumbnailUrl(circuit.thumbnail_light_url);
              const dark = toR2ThumbnailUrl(circuit.thumbnail_dark_url);
              const desc = plainDescription(circuit.description);
              const by = author(circuit);

              return (
                <Link
                  key={circuit.id}
                  href={`/circuit/${circuit.slug}`}
                  prefetch={false}
                  className={styles.card}
                >
                  <div className={styles.thumb}>
                    {light || dark ? (
                      <>
                        {/* Both are lazy, so only the visible theme loads */}
                        <Image
                          src={(light || dark) as string}
                          alt=""
                          fill
                          unoptimized
                          sizes={i === 0 ? "(min-width: 860px) 66vw, 100vw" : "(min-width: 860px) 33vw, 100vw"}
                          className="object-cover dark:hidden"
                        />
                        <Image
                          src={(dark || light) as string}
                          alt=""
                          fill
                          unoptimized
                          sizes={i === 0 ? "(min-width: 860px) 66vw, 100vw" : "(min-width: 860px) 33vw, 100vw"}
                          className="object-cover hidden dark:block"
                        />
                      </>
                    ) : (
                      <span className={styles.noPreview}>No preview yet</span>
                    )}
                  </div>
                  <h3 className={styles.cardTitle}>{circuit.title}</h3>
                  {desc && <p className={styles.cardDesc}>{desc}</p>}
                  <div className={styles.meta}>
                    {by && <span>@{by}</span>}
                    {circuit.license && <span>{circuit.license}</span>}
                    <span>
                      <strong>{circuit.copy_count.toLocaleString("en-US")}</strong>{" "}
                      {circuit.copy_count === 1 ? "copy" : "copies"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
