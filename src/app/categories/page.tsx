'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Grid, TrendingUp, Tag } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface PopularTag {
  tag: string;
  count: number;
}

export default function CategoriesPage() {
  const [tags, setTags] = useState<PopularTag[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch popular tags
  useEffect(() => {
    const fetchTags = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/tags');
        const data = await response.json();

        if (response.ok) {
          setTags(data.tags || []);
        } else {
          console.error('Error fetching tags:', data.error);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Tag className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold green-gradient bg-clip-text text-transparent">
                Popular Tags
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Browse circuits by the most popular tags. Explore components, projects, and circuit types used by the community.
            </p>
          </div>

          {/* Tags Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-muted-foreground">Loading tags...</p>
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tags found yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tags.map((tagData) => (
                <Link
                  key={tagData.tag}
                  href={`/browse?q=${encodeURIComponent(tagData.tag)}`}
                  className="group p-4 border rounded-lg hover:shadow-lg hover:border-primary/50 transition-all bg-card flex flex-col items-center justify-center text-center min-h-[100px]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors capitalize">
                      {tagData.tag}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    <TrendingUp className="w-3 h-3" />
                    {tagData.count} {tagData.count === 1 ? 'circuit' : 'circuits'}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Browse All Link */}
          <div className="text-center mt-12">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Grid className="w-5 h-5" />
              Browse All Circuits
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
