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
  /** Delay before rendering (to stagger multiple instances) */
  delay?: number;
}

// Global render queue to prevent simultaneous KiCanvas renders
let renderQueue: (() => void)[] = [];
let isProcessing = false;

function processQueue() {
  if (isProcessing || renderQueue.length === 0) return;
  isProcessing = true;

  const next = renderQueue.shift();
  if (next) {
    next();
    // Wait before processing next item
    setTimeout(() => {
      isProcessing = false;
      processQueue();
    }, 300);
  }
}

/**
 * KiCanvas viewer component for R2 thumbgen
 * Uses the MichaelAyles fork which has proper theme attribute support
 * Uses a global queue to prevent simultaneous renders which cause setTransform errors
 */
export function KiCanvas({
  src,
  controls = 'basic',
  theme = 'kicad',
  height = '100%',
  width = '100%',
  delay = 0,
}: KiCanvasProps) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReady(false);

    const queueRender = () => {
      renderQueue.push(() => {
        setReady(true);
      });
      processQueue();
    };

    // Add to queue with optional delay
    const timer = setTimeout(queueRender, delay);

    return () => {
      clearTimeout(timer);
      // Remove from queue if component unmounts
      renderQueue = renderQueue.filter(fn => fn !== queueRender);
    };
  }, [src, delay]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        minWidth: typeof width === 'number' ? width : undefined,
        minHeight: typeof height === 'number' ? height : undefined,
      }}
    >
      {ready ? (
        <kicanvas-embed
          src={src}
          controls={controls}
          theme={theme}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
