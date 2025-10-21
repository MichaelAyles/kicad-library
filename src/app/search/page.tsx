"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Loader } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { searchCircuits, type Circuit } from "@/lib/circuits";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams?.get("q") || "";
  const categoryParam = searchParams?.get("category") || "";
  const tagParam = searchParams?.get("tag") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Circuit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [selectedTags, setSelectedTags] = useState<string[]>(tagParam ? [tagParam] : []);

  useEffect(() => {
    if (initialQuery) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const { circuits, total } = await searchCircuits(query, 20, 0, {
        category: selectedCategory || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      });
      setResults(circuits);
      setTotalResults(total);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Search Circuits</h1>
            <p className="text-muted-foreground text-lg">
              Find the perfect subcircuit for your project
            </p>
          </div>

          {/* Search Input */}
          <div className="relative mb-8">
            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-6 h-6" />
            <input
              type="text"
              placeholder="Search by title, description, components, or tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-14 pr-4 py-4 text-lg border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Search Results */}
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="mb-12">
              <p className="text-muted-foreground mb-6">
                Found {totalResults} result{totalResults !== 1 ? "s" : ""} for &quot;{query}&quot;
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((circuit) => (
                  <Link
                    key={circuit.id}
                    href={`/circuit/${circuit.slug}`}
                    className="bg-card border rounded-lg p-6 hover:border-primary transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-2">{circuit.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {circuit.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {circuit.user && `@${circuit.user.username}`}
                      </span>
                      <span>{circuit.view_count} views</span>
                    </div>
                    {circuit.tags && circuit.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {circuit.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {circuit.tags.length > 3 && (
                          <span className="px-2 py-1 text-xs text-muted-foreground">
                            +{circuit.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ) : query && !isSearching ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                No results found for &quot;{query}&quot;
              </p>
              <p className="text-sm text-muted-foreground">
                Try different keywords or browse all circuits
              </p>
            </div>
          ) : null}

          {/* Quick Filters */}
          {!query && (
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
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setQuery(category.toLowerCase());
                        setTimeout(handleSearch, 100);
                      }}
                      className="px-4 py-3 border rounded-md text-center hover:bg-primary/10 hover:border-primary transition-colors"
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular Tags */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Popular Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    "opamp",
                    "regulator",
                    "esp32",
                    "arduino",
                    "usb-c",
                    "buck-converter",
                    "crystal",
                    "led-driver",
                    "sensor",
                    "amplifier",
                    "power",
                    "analog",
                    "digital",
                    "microcontroller",
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setQuery(tag);
                        setTimeout(handleSearch, 100);
                      }}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

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
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
