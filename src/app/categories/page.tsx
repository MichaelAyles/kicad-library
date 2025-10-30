'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Grid, TrendingUp } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { searchCircuits } from '@/lib/search';

interface Category {
  name: string;
  count: number;
  description: string;
}

const CATEGORIES: Category[] = [
  { name: 'Power Supply', count: 0, description: 'Voltage regulators, DC-DC converters, and power management circuits' },
  { name: 'Amplifier', count: 0, description: 'Op-amp circuits, audio amplifiers, and signal amplification' },
  { name: 'Microcontroller', count: 0, description: 'MCU circuits, Arduino, ESP32, STM32, and embedded systems' },
  { name: 'Sensor', count: 0, description: 'Temperature, pressure, motion, and environmental sensors' },
  { name: 'Communication', count: 0, description: 'UART, SPI, I2C, wireless, and networking interfaces' },
  { name: 'Display', count: 0, description: 'LED drivers, LCD controllers, and display interfaces' },
  { name: 'Motor Driver', count: 0, description: 'DC motor, stepper motor, and servo control circuits' },
  { name: 'Audio', count: 0, description: 'Audio processing, filters, and sound generation' },
  { name: 'RF', count: 0, description: 'Radio frequency, antenna matching, and wireless transmission' },
  { name: 'Digital Logic', count: 0, description: 'Logic gates, counters, and digital circuits' },
  { name: 'Analog', count: 0, description: 'Analog signal processing and conditioning' },
  { name: 'Interface', count: 0, description: 'Level shifters, buffers, and signal conversion' },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [loading, setLoading] = useState(true);

  // Fetch circuit counts for each category
  useEffect(() => {
    const fetchCategoryCounts = async () => {
      setLoading(true);
      try {
        const countsPromises = CATEGORIES.map(async (category) => {
          try {
            const { count } = await searchCircuits({ category: category.name, limit: 1 });
            return { ...category, count };
          } catch {
            return category;
          }
        });

        const updatedCategories = await Promise.all(countsPromises);
        setCategories(updatedCategories);
      } catch (error) {
        console.error('Error fetching category counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryCounts();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Grid className="w-10 h-10 text-primary" />
              <h1 className="text-4xl font-bold green-gradient bg-clip-text text-transparent">
                Circuit Categories
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Browse circuits organized by category. Find power supplies, amplifiers, microcontroller circuits, and more.
            </p>
          </div>

          {/* Categories Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-muted-foreground">Loading categories...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <Link
                  key={category.name}
                  href={`/browse?category=${encodeURIComponent(category.name)}`}
                  className="group p-6 border rounded-lg hover:shadow-lg hover:border-primary/50 transition-all bg-card"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    {category.count > 0 && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                        <TrendingUp className="w-3 h-3" />
                        {category.count}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
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
