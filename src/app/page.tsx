"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Upload, Copy, Zap, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getCircuits, type Circuit } from "@/lib/circuits";
import { toR2ThumbnailUrl } from "@/lib/thumbnail-url";

interface Stats {
  circuits: number;
  copies: number;
  makers: number;
}

export default function HomePage() {
  const { theme } = useTheme();
  const [topCircuits, setTopCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [stats, setStats] = useState<Stats>({
    circuits: 0,
    copies: 0,
    makers: 0,
  });

  // Load top circuits
  useEffect(() => {
    const loadTopCircuits = async () => {
      try {
        const { circuits } = await getCircuits(6, 0, "copies"); // Get top 6 most copied
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
    <div className="flex flex-col">
      <Header />

      {/* Bug Fix Banner */}
      {showBanner && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="container mx-auto max-w-6xl px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-foreground">
                <span className="font-medium">Heads up:</span> We recently fixed
                issues with some schematics not importing correctly into KiCad,
                and the preview renderer being flaky during upload. Both should
                be working now! If you spot any bugs, please{" "}
                <a
                  href="https://github.com/MichaelAyles/kicad-library/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  open a GitHub issue
                </a>{" "}
                or email{" "}
                <a
                  href="mailto:mike@mikeayles.com"
                  className="text-primary hover:underline font-medium"
                >
                  mike@mikeayles.com
                </a>
                .
              </p>
              <button
                onClick={() => setShowBanner(false)}
                className="shrink-0 p-1 hover:bg-primary/20 rounded transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Green Theme */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden py-20 px-4">
        {/* Subtle Background Gradient */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0, 255, 135, 0.1) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col items-center">
            {/* Hero Content */}
            <div className="text-center max-w-4xl">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="text-foreground">Copy-Paste </span>
                <span className="green-gradient-text">Circuits</span>
                <br />
                <span className="text-foreground">for KiCad</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Share and discover reusable schematic subcircuits. Built by
                makers, for makers.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link
                  href="/browse"
                  className="px-8 py-3 green-gradient text-black rounded-md font-semibold hover:shadow-lg green-glow-hover transition-all inline-flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  Browse Library
                </Link>
                <Link
                  href="/upload"
                  className="px-8 py-3 border-2 border-border hover:border-primary text-foreground rounded-md font-semibold hover:green-glow transition-all inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload Circuit
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-8 justify-center">
                <div className="flex flex-col">
                  <span className="text-3xl font-bold green-gradient-text">
                    {stats.circuits > 0 ? `${stats.circuits}` : "..."}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Circuits
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold green-gradient-text">
                    {stats.copies > 0
                      ? `${stats.copies.toLocaleString()}`
                      : "..."}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Downloads
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold green-gradient-text">
                    {stats.makers > 0 ? `${stats.makers}` : "..."}
                  </span>
                  <span className="text-sm text-muted-foreground">Makers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-4">
            <span className="green-gradient-text">How It Works</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Three simple steps to share and reuse circuits
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border hover:border-primary/50 transition-all hover:green-glow">
              <div className="w-16 h-16 rounded-full green-gradient flex items-center justify-center mb-4">
                <Copy className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Copy from KiCad</h3>
              <p className="text-muted-foreground">
                Select your circuit in KiCad and press Ctrl+C. The S-expression
                goes to your clipboard.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border hover:border-primary/50 transition-all hover:green-glow">
              <div className="w-16 h-16 rounded-full green-gradient flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Upload & Share</h3>
              <p className="text-muted-foreground">
                Paste into CircuitSnips, add a description and license. Your
                circuit is instantly searchable.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg border border-border hover:border-primary/50 transition-all hover:green-glow">
              <div className="w-16 h-16 rounded-full green-gradient flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. One-Click Paste</h3>
              <p className="text-muted-foreground">
                Others find your circuit, click copy, and paste directly into
                their KiCad projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Top Circuits */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-4xl font-bold">
              <span className="green-gradient-text">Top Circuits</span>
            </h2>
            <Link
              href="/browse"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
            >
              View all <span className="text-lg">→</span>
            </Link>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading top circuits...
            </div>
          )}

          {/* Empty State */}
          {!isLoading && topCircuits.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No circuits uploaded yet.
              </p>
              <Link
                href="/upload"
                className="text-primary hover:underline font-medium"
              >
                Be the first to share a circuit!
              </Link>
            </div>
          )}

          {/* Circuit Grid */}
          {!isLoading && topCircuits.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topCircuits.map((circuit) => {
                // Use theme-appropriate thumbnail, transformed to R2 URL
                const thumbnailUrl = toR2ThumbnailUrl(
                  theme === "dark"
                    ? circuit.thumbnail_dark_url
                    : circuit.thumbnail_light_url,
                );

                return (
                  <Link
                    key={circuit.id}
                    href={`/circuit/${circuit.slug}`}
                    className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg green-glow-hover transition-all group"
                  >
                    {/* Circuit Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden group-hover:bg-muted/80 transition-colors">
                      {thumbnailUrl ? (
                        <Image
                          src={thumbnailUrl}
                          alt={circuit.title}
                          fill
                          unoptimized
                          className="object-cover scale-110 group-hover:scale-115 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <span className="text-sm">No preview</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold mb-2 group-hover:green-gradient-text transition-all line-clamp-1">
                        {circuit.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {circuit.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {circuit.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                          >
                            {tag}
                          </span>
                        ))}
                        {circuit.tags.length > 2 && (
                          <span className="px-2 py-1 text-xs text-muted-foreground">
                            +{circuit.tags.length - 2}
                          </span>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          by @
                          {circuit.github_owner ||
                            circuit.user?.username ||
                            "unknown"}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="group-hover:text-primary transition-colors">
                            📋 {circuit.copy_count}
                          </span>
                          <span className="group-hover:text-primary transition-colors">
                            ⭐ {circuit.favorite_count}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
