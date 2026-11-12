"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { getCircuits, type Circuit } from "@/lib/circuits";
import { TitleBlock, type LibraryStats } from "@/components/home/TitleBlock";
import { HowItWorks } from "@/components/home/HowItWorks";
import { MostCopied } from "@/components/home/MostCopied";
import styles from "@/components/home/home.module.css";

const POPULAR_SEARCHES = ["ldo", "buck", "can", "usb-c", "rp2040", "stm32"];

export default function HomePage() {
  const [topCircuits, setTopCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<LibraryStats | null>(null);

  // Load top circuits
  useEffect(() => {
    const loadTopCircuits = async () => {
      try {
        const { circuits } = await getCircuits(6, 0, "copies"); // Top 6 most copied
        setTopCircuits(circuits);
      } catch (error) {
        console.error("Error loading top circuits:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTopCircuits();
  }, []);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch("/api/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    loadStats();
  }, []);

  return (
    <div className={styles.home}>
      <Header />

      <main>
        <div className="container mx-auto px-4">
          <section className={styles.hero} aria-labelledby="home-heading">
            <div>
              <h1 id="home-heading" className={styles.h1}>
                <span>Copy a working circuit.</span>{" "}
                <span>Paste it into KiCad.</span>
              </h1>
              <p className={styles.lede}>
                CircuitSnips is an open library of schematic subcircuits from
                real, open-source boards. Find a regulator, transceiver or MCU
                support circuit, check the preview, and paste it straight into
                Eeschema.
              </p>

              <div className={styles.search}>
                <label htmlFor="home-search" className={styles.searchLabel}>
                  Search by part number or job
                </label>
                <SearchAutocomplete
                  id="home-search"
                  placeholder="e.g. LDO, MCP2551, ESP32-S3"
                  className="relative w-full"
                  inputClassName={styles.searchInput}
                />
                <ul className={styles.popular} aria-label="Popular searches">
                  <li>Popular:</li>
                  {POPULAR_SEARCHES.map((q) => (
                    <li key={q}>
                      <Link
                        href={`/browse?q=${encodeURIComponent(q)}`}
                        prefetch={false}
                      >
                        {q}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.actions}>
                <span className={styles.netLabelWrap}>
                  <Link href="/browse" className={styles.netLabel}>
                    Browse the library
                  </Link>
                </span>
                <Link href="/upload" className={styles.textLink}>
                  Upload a circuit
                </Link>
              </div>
            </div>

            <TitleBlock stats={stats} />
          </section>
        </div>

        <HowItWorks />

        <MostCopied circuits={topCircuits} isLoading={isLoading} />
      </main>

      <Footer />
    </div>
  );
}
