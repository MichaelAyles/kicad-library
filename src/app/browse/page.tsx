'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Loader } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCircuits, type Circuit } from '@/lib/circuits';

export default function BrowsePage() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'copies' | 'recent' | 'favorites'>('copies');

  useEffect(() => {
    const loadCircuits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { circuits: data } = await getCircuits(12, 0, sortBy);
        setCircuits(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
        console.error('Error loading circuits:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCircuits();
  }, [sortBy]);

  const handleSortChange = (newSort: 'copies' | 'recent' | 'favorites') => {
    setSortBy(newSort);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Browse Circuits</h1>
            <p className="text-muted-foreground">
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
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              />
            </div>
            <button className="px-4 py-2 border rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-4 mb-6 text-sm">
            <span className="text-muted-foreground">Sort by:</span>
            <button
              onClick={() => handleSortChange('copies')}
              className={sortBy === 'copies' ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}
            >
              Most Copied
            </button>
            <button
              onClick={() => handleSortChange('recent')}
              className={sortBy === 'recent' ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}
            >
              Recent
            </button>
            <button
              onClick={() => handleSortChange('favorites')}
              className={sortBy === 'favorites' ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}
            >
              Favorites
            </button>
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
              {circuits.map((circuit) => (
                <Link
                  key={circuit.id}
                  href={`/circuit/${circuit.slug}`}
                  className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Preview Placeholder */}
                  <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-muted/80 transition-colors">
                    <span className="text-sm">{circuit.copy_count} copies</span>
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
                      {circuit.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
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
                        <span>📋 {circuit.copy_count}</span>
                        <span>⭐ {circuit.favorite_count}</span>
                        <span>💬 {circuit.comment_count}</span>
                      </div>
                    </div>

                    {/* License Badge */}
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">{circuit.license}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Load More */}
          {!isLoading && circuits.length > 0 && (
            <div className="mt-12 text-center">
              <button className="px-6 py-3 border rounded-md hover:bg-muted/50 transition-colors">
                Load More Circuits
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
