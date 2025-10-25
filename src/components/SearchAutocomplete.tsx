"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader, ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";

interface Circuit {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail_light_url: string;
  thumbnail_dark_url: string;
  profiles: {
    username: string;
  };
}

export function SearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Circuit[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme } = useTheme();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
          const data = await response.json();
          if (response.ok) {
            setResults(data.circuits || []);
            setIsOpen(true);
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex === -1 || selectedIndex === results.length) {
            // View all results
            router.push(`/search?q=${encodeURIComponent(query)}`);
            setIsOpen(false);
            inputRef.current?.blur();
          } else if (selectedIndex >= 0 && selectedIndex < results.length) {
            // Navigate to selected circuit
            router.push(`/circuit/${results[selectedIndex].slug}`);
            setIsOpen(false);
            inputRef.current?.blur();
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, selectedIndex, results, query, router]
  );

  const handleCircuitClick = (slug: string) => {
    router.push(`/circuit/${slug}`);
    setIsOpen(false);
    setQuery("");
  };

  const handleViewAll = () => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full max-w-xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder="Search circuits..."
          className="w-full pl-10 pr-10 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {isLoading && (
          <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-xl max-h-[500px] overflow-y-auto"
        >
          {/* Circuit Results */}
          <div className="py-2">
            {results.map((circuit, index) => (
              <button
                key={circuit.id}
                onClick={() => handleCircuitClick(circuit.slug)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                  selectedIndex === index ? "bg-muted/50" : ""
                }`}
              >
                {/* Thumbnail */}
                {(circuit.thumbnail_light_url || circuit.thumbnail_dark_url) && (
                  <img
                    src={
                      theme === "dark"
                        ? circuit.thumbnail_dark_url || circuit.thumbnail_light_url
                        : circuit.thumbnail_light_url || circuit.thumbnail_dark_url
                    }
                    alt={circuit.title}
                    className="w-16 h-16 rounded object-cover flex-shrink-0 bg-muted"
                  />
                )}

                {/* Circuit Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {circuit.title}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    by @{circuit.profiles.username}
                  </p>
                  {circuit.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {circuit.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {circuit.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{circuit.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* View All Results */}
          <button
            onClick={handleViewAll}
            className={`w-full px-4 py-3 flex items-center justify-between border-t hover:bg-muted/50 transition-colors ${
              selectedIndex === results.length ? "bg-muted/50" : ""
            }`}
          >
            <span className="font-medium text-sm text-primary">
              View all results for &ldquo;{query}&rdquo;
            </span>
            <ArrowRight className="w-4 h-4 text-primary" />
          </button>
        </div>
      )}

      {/* No Results */}
      {isOpen && !isLoading && query.trim().length >= 2 && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-card border rounded-lg shadow-xl p-4"
        >
          <p className="text-sm text-muted-foreground text-center">
            No circuits found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
