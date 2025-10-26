"use client";

import { useEffect, useRef, useState } from "react";
import { KiCanvasCard } from "@/components/KiCanvas";

interface SchematicViewerProps {
  sexpr: string;
  title?: string;
  slug: string;
}

/**
 * Interactive schematic viewer component using KiCanvas
 *
 * Uses KiCanvas from https://kicanvas.org for interactive viewing
 * Falls back to expandable S-expression view if needed
 */
export function SchematicViewer({ sexpr, title, slug }: SchematicViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [componentCount, setComponentCount] = useState(0);

  // Strip any existing .kicad_sch extension to avoid double extensions
  const cleanSlug = slug.replace(/\.kicad_sch$/i, '');
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Count symbol instances in the S-expression
    const symbolMatches = sexpr.match(/\(symbol \(lib_id/g);
    setComponentCount(symbolMatches ? symbolMatches.length : 0);

    console.log('Loading KiCanvas with slug:', cleanSlug);
    console.log('S-expression preview:', sexpr.substring(0, 100));
  }, [sexpr, cleanSlug]);

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
      <div className="p-8" ref={viewerRef}>
        <KiCanvasCard
          slug={cleanSlug}
          controls="full"
          height="500px"
        />
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
      <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-3 border-t text-sm text-blue-900 dark:text-blue-100">
        <p>
          💡 <strong>Tip:</strong> Use the interactive viewer above to explore the circuit. Click &quot;Copy to Clipboard&quot; button
          on the main page to get this circuit with attribution, then paste directly into your KiCad project (Ctrl+V).
        </p>
      </div>
    </div>
  );
}
