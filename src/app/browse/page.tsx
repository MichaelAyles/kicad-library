'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Loader } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCircuits, type Circuit } from '@/lib/circuits';

const CIRCUITS_PER_PAGE = 12;

export default function BrowsePage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'copies' | 'recent' | 'favorites'>('copies');
  const [hideImported, setHideImported] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load initial circuits when sort or filter changes
  useEffect(() => {
    const loadCircuits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { circuits: data } = await getCircuits(CIRCUITS_PER_PAGE, 0, sortBy, hideImported);
        setCircuits(data);
        setHasMore(data.length === CIRCUITS_PER_PAGE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
        console.error('Error loading circuits:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCircuits();
  }, [sortBy, hideImported]);

  // Load more circuits for infinite scroll
  const loadMoreCircuits = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const newOffset = circuits.length;
      const { circuits: data } = await getCircuits(CIRCUITS_PER_PAGE, newOffset, sortBy, hideImported);

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setCircuits(prev => [...prev, ...data]);
        setHasMore(data.length === CIRCUITS_PER_PAGE);
      }
    } catch (err) {
      console.error('Error loading more circuits:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [circuits.length, sortBy, hideImported, hasMore, isLoadingMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMoreCircuits();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, loadMoreCircuits]);

  const handleSortChange = (newSort: 'copies' | 'recent' | 'favorites') => {
    setSortBy(newSort);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-2">
              <span className="green-gradient-text">Browse Circuits</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Discover reusable schematic subcircuits for your KiCad projects
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search circuits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-background transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 border border-border rounded-md hover:border-primary hover:green-glow transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>

          {/* Sort Options and Filter Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Sort by:</span>
              <button
                onClick={() => handleSortChange('copies')}
                className={sortBy === 'copies' ? 'text-primary font-semibold relative' : 'text-muted-foreground hover:text-primary transition-colors'}
              >
                Most Copied
                {sortBy === 'copies' && <span className="absolute -bottom-1 left-0 w-full h-0.5 green-gradient" />}
              </button>
              <button
                onClick={() => handleSortChange('recent')}
                className={sortBy === 'recent' ? 'text-primary font-semibold relative' : 'text-muted-foreground hover:text-primary transition-colors'}
              >
                Recent
                {sortBy === 'recent' && <span className="absolute -bottom-1 left-0 w-full h-0.5 green-gradient" />}
              </button>
              <button
                onClick={() => handleSortChange('favorites')}
                className={sortBy === 'favorites' ? 'text-primary font-semibold relative' : 'text-muted-foreground hover:text-primary transition-colors'}
              >
                Favorites
                {sortBy === 'favorites' && <span className="absolute -bottom-1 left-0 w-full h-0.5 green-gradient" />}
              </button>
            </div>

            {/* Hide Imported Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Hide bulk-imported circuits
              </span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={hideImported}
                  onChange={(e) => setHideImported(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-muted rounded-full peer peer-checked:bg-primary transition-colors border-2 border-border peer-checked:border-primary"></div>
                <div className="absolute left-1 top-1 w-5 h-5 bg-background rounded-full transition-transform peer-checked:translate-x-7 shadow-md"></div>
              </div>
            </label>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-8 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              Failed to load circuits: {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && circuits.length === 0 && !error && (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No circuits found yet.</p>
              <Link href="/upload" className="text-primary hover:underline font-medium">
                Be the first to share a circuit!
              </Link>
            </div>
          )}

          {/* Subcircuit Grid */}
          {!isLoading && circuits.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {circuits.map((circuit) => {
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
                    className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg green-glow-hover transition-all group"
                  >
                    {/* Circuit Thumbnail */}
                    <div className="aspect-video bg-muted relative overflow-hidden group-hover:bg-muted/80 transition-colors">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt={circuit.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      {circuit.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                      {circuit.tags.length > 3 && (
                        <span className="px-2 py-1 text-xs text-muted-foreground">
                          +{circuit.tags.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>by @{circuit.user?.username || 'unknown'}</span>
                      <div className="flex items-center gap-3">
                        <span className="group-hover:text-primary transition-colors">📋 {circuit.copy_count}</span>
                        <span className="group-hover:text-primary transition-colors">⭐ {circuit.favorite_count}</span>
                        <span className="group-hover:text-primary transition-colors">💬 {circuit.comment_count}</span>
                      </div>
                    </div>

                    {/* License Badge */}
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">{circuit.license}</span>
                    </div>
                  </div>
                </Link>
              );
              })}
            </div>
          )}

          {/* Infinite Scroll Trigger & Loading Indicator */}
          {!isLoading && circuits.length > 0 && (
            <div className="mt-12">
              {/* Sentinel element for intersection observer */}
              <div ref={observerTarget} className="h-20 flex items-center justify-center">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Loading more circuits...</span>
                  </div>
                )}
                {!hasMore && circuits.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    You&apos;ve reached the end! 🎉
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
