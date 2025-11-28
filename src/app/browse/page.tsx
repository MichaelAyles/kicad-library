'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, Loader, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SearchAutocomplete } from '@/components/SearchAutocomplete';
import { getCircuits, type Circuit } from '@/lib/circuits';
import { searchCircuits, type SearchCircuit } from '@/lib/search';
import { toR2ThumbnailUrl } from '@/lib/thumbnail-url';

const CIRCUITS_PER_PAGE = 50;

function BrowsePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [circuits, setCircuits] = useState<(Circuit | SearchCircuit)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'copies' | 'recent' | 'favorites' | 'relevance'>('copies');
  const [hideImported, setHideImported] = useState(false);
  const [activeQuery, setActiveQuery] = useState(''); // The query being used for results
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<HTMLDivElement>(null);

  // Initialize from URL params
  useEffect(() => {
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || null;

    setActiveQuery(query);
    setActiveCategory(category);
    setIsSearchMode(!!query || !!category);

    if (query || category) {
      setSortBy('relevance');
    }
  }, [searchParams]);

  // Load circuits when filters/sort/search changes (reset to page 0)
  useEffect(() => {
    const loadCircuits = async () => {
      setIsLoading(true);
      setError(null);
      setPage(0);
      try {
        if (activeQuery || activeCategory) {
          // Use weighted search
          const sortMap: Record<string, 'relevance' | 'recent' | 'popular' | 'views' | 'favorites'> = {
            copies: 'popular',
            recent: 'recent',
            favorites: 'favorites',
            relevance: 'relevance'
          };

          const { circuits: data } = await searchCircuits({
            query: activeQuery || undefined,
            category: activeCategory || undefined,
            sort: sortMap[sortBy],
            limit: CIRCUITS_PER_PAGE,
            offset: 0,
            excludeImported: hideImported,
          });
          setCircuits(data);
          setHasMore(data.length === CIRCUITS_PER_PAGE);
        } else {
          // Browse all circuits
          const sortMap: Record<string, 'copies' | 'recent' | 'favorites'> = {
            copies: 'copies',
            recent: 'recent',
            favorites: 'favorites',
            relevance: 'copies' // fallback
          };

          const { circuits: data } = await getCircuits(CIRCUITS_PER_PAGE, 0, sortMap[sortBy], hideImported);
          setCircuits(data);
          setHasMore(data.length === CIRCUITS_PER_PAGE);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
        console.error('Error loading circuits:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCircuits();
  }, [sortBy, hideImported, activeQuery, activeCategory]);

  // Load more circuits for infinite scrolling
  const loadMoreCircuits = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const offset = nextPage * CIRCUITS_PER_PAGE;

      if (activeQuery || activeCategory) {
        // Use weighted search
        const sortMap: Record<string, 'relevance' | 'recent' | 'popular' | 'views' | 'favorites'> = {
          copies: 'popular',
          recent: 'recent',
          favorites: 'favorites',
          relevance: 'relevance'
        };

        const { circuits: data } = await searchCircuits({
          query: activeQuery || undefined,
          category: activeCategory || undefined,
          sort: sortMap[sortBy],
          limit: CIRCUITS_PER_PAGE,
          offset,
          excludeImported: hideImported,
        });

        if (data.length > 0) {
          setCircuits(prev => [...prev, ...data]);
          setPage(nextPage);
          setHasMore(data.length === CIRCUITS_PER_PAGE);
        } else {
          setHasMore(false);
        }
      } else {
        // Browse all circuits
        const sortMap: Record<string, 'copies' | 'recent' | 'favorites'> = {
          copies: 'copies',
          recent: 'recent',
          favorites: 'favorites',
          relevance: 'copies' // fallback
        };

        const { circuits: data } = await getCircuits(CIRCUITS_PER_PAGE, offset, sortMap[sortBy], hideImported);

        if (data.length > 0) {
          setCircuits(prev => [...prev, ...data]);
          setPage(nextPage);
          setHasMore(data.length === CIRCUITS_PER_PAGE);
        } else {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error loading more circuits:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, activeQuery, activeCategory, sortBy, hideImported]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMoreCircuits();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMoreCircuits]);

  const handleSortChange = (newSort: 'copies' | 'recent' | 'favorites' | 'relevance') => {
    setSortBy(newSort);
  };

  const handleClearSearch = () => {
    setActiveQuery('');
    setActiveCategory(null);
    setIsSearchMode(false);
    router.push('/browse');
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
              <span className="green-gradient-text">
                {isSearchMode ? 'Search Results' : 'Browse Circuits'}
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              {isSearchMode
                ? `Found ${circuits.length} circuit${circuits.length !== 1 ? 's' : ''}`
                : 'Discover reusable schematic subcircuits for your KiCad projects'}
            </p>
          </div>

          {/* Active Filters */}
          {(activeQuery || activeCategory) && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {activeQuery && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                  <span>Search: &quot;{activeQuery}&quot;</span>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (activeCategory) params.set('category', activeCategory);
                      router.push(params.toString() ? `/browse?${params.toString()}` : '/browse');
                    }}
                    className="ml-1 hover:text-primary/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {activeCategory && (
                <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                  <span>Category: {activeCategory}</span>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (activeQuery) params.set('q', activeQuery);
                      router.push(params.toString() ? `/browse?${params.toString()}` : '/browse');
                    }}
                    className="ml-1 hover:text-primary/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <button
                onClick={handleClearSearch}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Search with Autocomplete */}
          <div className="mb-8 max-w-3xl mx-auto">
            <SearchAutocomplete />
          </div>

          {/* Sort Options and Filter Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Sort by:</span>
              {isSearchMode && (
                <button
                  onClick={() => handleSortChange('relevance')}
                  className={sortBy === 'relevance' ? 'text-primary font-semibold relative' : 'text-muted-foreground hover:text-primary transition-colors'}
                >
                  Relevance
                  {sortBy === 'relevance' && <span className="absolute -bottom-1 left-0 w-full h-0.5 green-gradient" />}
                </button>
              )}
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
                // Use theme-appropriate thumbnail, transformed to R2 URL
                const thumbnailUrl = toR2ThumbnailUrl(theme === 'dark' ? circuit.thumbnail_dark_url : circuit.thumbnail_light_url);

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
                          className="w-full h-full object-cover scale-110 group-hover:scale-115 transition-transform duration-300"
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
                      <span>
                        by @{('github_owner' in circuit && circuit.github_owner
                          ? circuit.github_owner
                          : 'user' in circuit
                          ? circuit.user?.username
                          : 'profiles' in circuit
                            ? circuit.profiles?.username
                            : 'unknown') || 'unknown'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="group-hover:text-primary transition-colors">📋 {circuit.copy_count}</span>
                        <span className="group-hover:text-primary transition-colors">⭐ {circuit.favorite_count}</span>
                        {'comment_count' in circuit && (
                          <span className="group-hover:text-primary transition-colors">💬 {circuit.comment_count}</span>
                        )}
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

          {/* Infinite Scroll Trigger and Loading Indicator */}
          {!isLoading && circuits.length > 0 && (
            <div ref={observerRef} className="mt-12 text-center py-8">
              {isLoadingMore && (
                <div className="flex flex-col items-center gap-2">
                  <Loader className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Loading more circuits...</p>
                </div>
              )}
              {!hasMore && !isLoadingMore && circuits.length >= CIRCUITS_PER_PAGE && (
                <p className="text-muted-foreground text-sm">
                  You&apos;ve reached the end! Showing all {circuits.length} circuits.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    }>
      <BrowsePageContent />
    </Suspense>
  );
}
