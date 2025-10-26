"use client";

import { useState, useEffect } from "react";

// Declare the kicanvas-embed custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'kicanvas-embed': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        controls?: 'none' | 'basic' | 'full';
        theme?: 'kicad' | 'witchhazel';
      }, HTMLElement>;
    }
  }
}

interface KiCanvasProps {
  /** Circuit slug to load from API endpoint (e.g., "my-circuit") */
  slug?: string;
  /** Direct URL to schematic file (e.g., "/api/preview/abc123.kicad_sch") */
  src?: string;
  /** Controls level */
  controls?: 'none' | 'basic' | 'full';
  /** Additional styling */
  className?: string;
  /** Height of the viewer */
  height?: string | number;
  /** Width of the viewer */
  width?: string | number;
}

/**
 * Unified KiCanvas viewer component
 *
 * Handles all the quirks of rendering KiCad schematics consistently:
 * - Uses API endpoint to strip hierarchical sheets
 * - Handles mounting/hydration
 * - Consistent styling and controls
 *
 * Usage:
 * ```tsx
 * // With circuit slug (recommended - handles hierarchical sheets)
 * <KiCanvas slug="my-circuit" controls="full" />
 *
 * // With direct URL
 * <KiCanvas src="/api/preview/abc123.kicad_sch" controls="basic" />
 * ```
 */
export function KiCanvas({
  slug,
  src,
  controls = 'basic',
  className = '',
  height = '100%',
  width = '100%',
}: KiCanvasProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the source URL
  const schematicUrl = slug
    ? `/api/schematic/${slug}.kicad_sch`
    : src;

  if (!schematicUrl) {
    console.error('KiCanvas: Either slug or src must be provided');
    return (
      <div className={`bg-muted/20 flex items-center justify-center ${className}`} style={{ height, width }}>
        <p className="text-muted-foreground text-sm">Error: No schematic source provided</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className={`bg-muted/20 animate-pulse ${className}`} style={{ height, width }} />
    );
  }

  return (
    <kicanvas-embed
      src={schematicUrl}
      controls={controls}
      className={className}
      style={{
        width,
        height,
        display: 'block',
      }}
    />
  );
}

/**
 * KiCanvas viewer with a border and background (common styling)
 */
export function KiCanvasCard({
  slug,
  src,
  controls = 'full',
  height = '500px',
}: Omit<KiCanvasProps, 'className' | 'width'>) {
  return (
    <div className="rounded-md overflow-hidden border-2 border-muted" style={{ height }}>
      <KiCanvas
        slug={slug}
        src={src}
        controls={controls}
        height="100%"
        width="100%"
      />
    </div>
  );
}
