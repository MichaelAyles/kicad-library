'use client';

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search as SearchIcon, Filter, SortDesc } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";

interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  license: string;
  thumbnail_light_url: string;
  thumbnail_dark_url: string;
  view_count: number;
  copy_count: number;
  favorite_count: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string;
  };
}

interface PopularTag {
  tag: string;
  count: number;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState(searchParams.get('sort') || 'relevance');
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);

  const performSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      if (sort) params.set('sort', sort);

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setCircuits(data.circuits || []);
      } else {
        console.error('Search failed:', data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [searchParams, sort]);

  useEffect(() => {
    const q = searchParams.get('q');
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');

    if (q || category || tag) {
      performSearch();
    }
  }, [searchParams, performSearch]);

  // Fetch popular tags on mount
  useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        const response = await fetch('/api/tags');
        const data = await response.json();
        if (response.ok) {
          setPopularTags(data.tags || []);
        }
      } catch (error) {
        console.error('Error fetching popular tags:', error);
      }
    };

    fetchPopularTags();
  }, []);

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 green-gradient bg-clip-text text-transparent">
              Search Circuits
            </h1>
            <p className="text-muted-foreground text-lg">
              Find the perfect subcircuit for your project
            </p>
          </div>

          {/* Search Input with Autocomplete */}
          <div className="mb-8 max-w-3xl mx-auto">
            <SearchAutocomplete />
          </div>

          {/* Sort Options */}
          {searched && (
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                {circuits.length} {circuits.length === 1 ? 'result' : 'results'} found
              </p>
              <div className="flex items-center gap-2">
                <SortDesc className="w-4 h-4 text-muted-foreground" />
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-3 py-1 border rounded-md bg-background text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="recent">Most Recent</option>
                  <option value="popular">Most Copied</option>
                  <option value="views">Most Viewed</option>
                  <option value="favorites">Most Favorited</option>
                </select>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-muted-foreground">Searching circuits...</p>
            </div>
          )}

          {/* Search Results */}
          {!loading && searched && circuits.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {circuits.map((circuit) => (
                <Link
                  key={circuit.id}
                  href={`/circuit/${circuit.slug}`}
                  className="group border rounded-lg overflow-hidden hover:shadow-xl transition-all hover:border-primary/50"
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <img
                      src={circuit.thumbnail_light_url || '/placeholder-circuit.png'}
                      alt={circuit.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                      {circuit.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {circuit.description}
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <img
                        src={circuit.profiles.avatar_url || '/default-avatar.png'}
                        alt={circuit.profiles.username}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="text-sm text-muted-foreground">
                        {circuit.profiles.username}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {circuit.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{circuit.view_count} views</span>
                      <span>{circuit.copy_count} copies</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && searched && circuits.length === 0 && (
            <div className="text-center py-12">
              <SearchIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No circuits found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search terms or browse popular categories below
              </p>
            </div>
          )}

          {/* Quick Filters - Show when no search performed or no results */}
          {(!searched || circuits.length === 0) && (
            <>
              <div className="mb-12">
                <h2 className="text-lg font-semibold mb-4">Popular Categories</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    "Power Supply",
                    "Amplifier",
                    "Microcontroller",
                    "Sensor Interface",
                    "USB",
                    "Display",
                    "Motor Control",
                    "Audio",
                  ].map((category) => (
                    <Link
                      key={category}
                      href={`/search?category=${category.toLowerCase().replace(" ", "-")}`}
                      className="px-4 py-3 border rounded-md text-center hover:bg-primary/10 hover:border-primary transition-colors"
                    >
                      {category}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Popular Tags */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Popular Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {popularTags.length > 0 ? (
                    popularTags.map((tagData) => (
                      <Link
                        key={tagData.tag}
                        href={`/search?tag=${tagData.tag}`}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <span>{tagData.tag}</span>
                        <span className="text-xs opacity-60">({tagData.count})</span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading popular tags...</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Advanced Search Info */}
          <div className="mt-12 p-6 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2">Search Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Search by component name (e.g., &quot;LM358&quot;, &quot;ESP32&quot;)</li>
              <li>• Search by function (e.g., &quot;voltage regulator&quot;, &quot;amplifier&quot;)</li>
              <li>• Use tags to filter results (e.g., &quot;power&quot;, &quot;usb&quot;)</li>
              <li>• Click categories for common circuit types</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-muted-foreground">Loading search...</p>
          </div>
        </main>
        <Footer />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
