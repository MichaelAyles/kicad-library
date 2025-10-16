"use client";

import { useEffect, useRef, useState } from "react";

interface SchematicViewerProps {
  sexpr: string;
  title?: string;
}

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

/**
 * Interactive schematic viewer component using KiCanvas
 *
 * Uses KiCanvas from https://kicanvas.org for interactive viewing
 * Falls back to expandable S-expression view if needed
 */
export function SchematicViewer({ sexpr, title }: SchematicViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [componentCount, setComponentCount] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState(false);

  useEffect(() => {
    // Count symbol instances in the S-expression
    const symbolMatches = sexpr.match(/\(symbol \(lib_id/g);
    setComponentCount(symbolMatches ? symbolMatches.length : 0);

    // Create a blob URL for the S-expression so KiCanvas can load it
    try {
      const blob = new Blob([sexpr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      // Cleanup blob URL on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      setViewerError(true);
    }
  }, [sexpr]);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Viewer Header */}
      <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Schematic Preview</h3>
          <p className="text-sm text-muted-foreground">
            {componentCount} component{componentCount !== 1 ? "s" : ""} detected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-sm border rounded-md hover:bg-background transition-colors"
          >
            {isExpanded ? "Collapse" : "Expand"} S-Expression
          </button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="p-8">
        {blobUrl && !viewerError ? (
          <div className="rounded-md overflow-hidden border-2 border-muted" style={{ minHeight: '500px' }}>
            <kicanvas-embed
              src={blobUrl}
              controls="full"
              theme="kicad"
              style={{ width: '100%', height: '500px', display: 'block' }}
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 rounded-md flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted">
            <div className="text-center max-w-md">
              <svg
                className="w-24 h-24 mx-auto mb-4 text-primary/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              <p className="text-lg font-medium mb-2">
                {viewerError ? "Viewer Loading..." : "Preparing Interactive Viewer"}
              </p>
              <p className="text-sm">
                {title || "Circuit schematic"} with {componentCount} components
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Expandable S-Expression View */}
      {isExpanded && (
        <div className="border-t">
          <div className="p-4 bg-muted/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Raw S-Expression</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sexpr);
                }}
                className="text-xs px-2 py-1 border rounded hover:bg-background transition-colors"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs font-mono bg-background border rounded p-4 overflow-x-auto max-h-96 overflow-y-auto">
              {sexpr}
            </pre>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-blue-50 px-4 py-3 border-t text-sm text-blue-900">
        <p>
          💡 <strong>Tip:</strong> Use the interactive viewer above to explore the circuit. Click &quot;Copy to Clipboard&quot; button
          on the main page to get this circuit with attribution, then paste directly into your KiCad project (Ctrl+V).
        </p>
      </div>
    </div>
  );
}
