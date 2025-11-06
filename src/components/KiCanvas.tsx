"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";

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
  /** Circuit ID for copy tracking (optional) */
  circuitId?: string;
  /** Callback when user copies from viewer */
  onCopy?: () => void;
}

/**
 * Unified KiCanvas viewer component
 *
 * Handles all the quirks of rendering KiCad schematics consistently:
 * - Uses API endpoint to strip hierarchical sheets
 * - Handles mounting/hydration
 * - Consistent styling and controls
 * - Syncs theme with page (light/dark mode)
 * - Tracks clipboard copies from viewer
 *
 * Usage:
 * ```tsx
 * // With circuit slug (recommended - handles hierarchical sheets)
 * <KiCanvas slug="my-circuit" controls="full" circuitId="abc-123" onCopy={handleCopy} />
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
  circuitId,
  onCopy,
}: KiCanvasProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const viewerRef = useRef<HTMLElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync theme with KiCanvas
  useEffect(() => {
    if (!mounted || !viewerRef.current) return;

    const viewer = viewerRef.current;
    const currentTheme = resolvedTheme || theme;
    const kicanvasTheme = currentTheme === 'dark' ? 'witchhazel' : 'kicad';

    // Update theme attribute
    viewer.setAttribute('theme', kicanvasTheme);

    console.log(`KiCanvas theme updated to: ${kicanvasTheme} (page theme: ${currentTheme})`);
  }, [mounted, theme, resolvedTheme]);

  // Track Ctrl+C copies from the viewer
  useEffect(() => {
    if (!mounted || !viewerRef.current) return;

    const viewer = viewerRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        console.log('Copy detected from KiCanvas viewer');

        // Call the onCopy callback if provided
        if (onCopy) {
          onCopy();
        }
      }
    };

    // Add keyboard event listener to the viewer
    viewer.addEventListener('keydown', handleKeyDown as any);

    return () => {
      viewer.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [mounted, onCopy]);

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

  // Determine initial theme
  const currentTheme = resolvedTheme || theme;
  const kicanvasTheme = currentTheme === 'dark' ? 'witchhazel' : 'kicad';

  return (
    <kicanvas-embed
      ref={viewerRef as any}
      src={schematicUrl}
      controls={controls}
      theme={kicanvasTheme}
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
  circuitId,
  onCopy,
}: Omit<KiCanvasProps, 'className' | 'width'>) {
  return (
    <div className="rounded-md overflow-hidden border-2 border-muted" style={{ height }}>
      <KiCanvas
        slug={slug}
        src={src}
        controls={controls}
        height="100%"
        width="100%"
        circuitId={circuitId}
        onCopy={onCopy}
      />
    </div>
  );
}
