"use client";

import { useState, useEffect, useRef } from "react";

// Declare the kicanvas-embed custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'kicanvas-embed': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        controls?: 'none' | 'basic' | 'full';
        theme?: string;
      }, HTMLElement>;
    }
  }
}

interface KiCanvasProps {
  /** Direct URL to schematic file */
  src: string;
  /** Controls level */
  controls?: 'none' | 'basic' | 'full';
  /** Theme - 'kicad' for light, 'witchhazel' for dark */
  theme?: 'kicad' | 'witchhazel';
  /** Height of the viewer */
  height?: string | number;
  /** Width of the viewer */
  width?: string | number;
}

/**
 * KiCanvas viewer component for R2 thumbgen
 * Uses the MichaelAyles fork which has proper theme attribute support
 */
export function KiCanvas({
  src,
  controls = 'basic',
  theme = 'kicad',
  height = '100%',
  width = '100%',
}: KiCanvasProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-gray-100 animate-pulse" style={{ height, width }} />
    );
  }

  // The MichaelAyles fork properly handles the theme attribute
  // and propagates it to child schematic_app/board_app elements
  return (
    <kicanvas-embed
      src={src}
      controls={controls}
      theme={theme}
      style={{
        width,
        height,
        display: 'block',
      }}
    />
  );
}
