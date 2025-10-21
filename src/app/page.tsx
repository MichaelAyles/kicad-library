'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Upload, Copy, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getCircuits, type Circuit } from "@/lib/circuits";

export default function HomePage() {
  const [topCircuits, setTopCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load top circuits
  useEffect(() => {
    const loadTopCircuits = async () => {
      try {
        const { circuits } = await getCircuits(6, 0, 'copies'); // Get top 6 most copied
        setTopCircuits(circuits);
      } catch (error) {
        console.error('Error loading top circuits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTopCircuits();
  }, []);
  return (
    <div className="flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Copy-Paste Circuits for KiCad
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Share and discover reusable schematic subcircuits. Built by makers, for makers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/browse"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              Browse Library
            </Link>
            <Link
              href="/upload"
              className="px-8 py-3 border border-primary text-primary rounded-md font-medium hover:bg-primary/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Circuit
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Copy className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Copy from KiCad</h3>
              <p className="text-muted-foreground">
                Select your circuit in KiCad and press Ctrl+C. The S-expression goes to your clipboard.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Upload & Share</h3>
              <p className="text-muted-foreground">
                Paste into CircuitSnips, add a description and license. Your circuit is instantly searchable.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. One-Click Paste</h3>
              <p className="text-muted-foreground">
                Others find your circuit, click copy, and paste directly into their KiCad projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Top Circuits */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Top Circuits</h2>
            <Link href="/browse" className="text-sm font-medium text-primary hover:underline">
              View all →
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
              <p className="text-muted-foreground mb-4">No circuits uploaded yet.</p>
              <Link href="/upload" className="text-primary hover:underline font-medium">
                Be the first to share a circuit!
              </Link>
            </div>
          )}

          {/* Circuit Grid */}
          {!isLoading && topCircuits.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topCircuits.map((circuit) => {
                // Determine which thumbnail to show based on theme
                const currentTheme = theme === 'system' ? systemTheme : theme;
                const isDark = currentTheme === 'dark';
                const thumbnailUrl = mounted
                  ? (isDark ? circuit.thumbnail_dark_url : circuit.thumbnail_light_url) || circuit.thumbnail_light_url
                  : circuit.thumbnail_light_url;

                return (
                  <Link
                    key={circuit.id}
                    href={`/circuit/${circuit.slug}`}
                    className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    {/* Circuit Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden group-hover:bg-muted/80 transition-colors">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={circuit.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <span className="text-sm">No preview</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-1">
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
                            className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
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
                        <span>by @{circuit.user?.username || 'unknown'}</span>
                        <div className="flex items-center gap-3">
                          <span>📋 {circuit.copy_count}</span>
                          <span>⭐ {circuit.favorite_count}</span>
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
