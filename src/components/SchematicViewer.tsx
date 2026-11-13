"use client";

import { useRef, useState } from "react";
import { KiCanvasCard } from "@/components/KiCanvas";

interface SchematicViewerProps {
  sexpr: string;
  title?: string;
  slug: string;
  circuitId?: string;
  schematicR2Url: string; // Direct R2 URL for KiCanvas (required)
  /** Symbol count from the AST parser (validateSExpression metadata) */
  componentCount?: number;
  /** Whether sexpr is still loading, loaded, or failed to load */
  sexprStatus?: "loading" | "ready" | "error";
  /** Retry loading sexpr after an error */
  onRetry?: () => void;
  onCopy?: () => void;
}

/**
 * Interactive schematic viewer component using KiCanvas
 *
 * Uses KiCanvas from https://kicanvas.org for interactive viewing
 * Falls back to expandable S-expression view if needed
 */
export function SchematicViewer({
  sexpr,
  title,
  slug,
  circuitId,
  schematicR2Url,
  componentCount,
  sexprStatus = "ready",
  onRetry,
  onCopy,
}: SchematicViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Viewer Header */}
      <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Schematic Preview</h3>
          {componentCount !== undefined && (
            <p className="text-sm text-muted-foreground">
              {componentCount} component{componentCount !== 1 ? "s" : ""}{" "}
              detected
            </p>
          )}
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
          src={schematicR2Url}
          controls="full"
          height="500px"
          circuitId={circuitId}
          onCopy={onCopy}
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
                disabled={sexprStatus !== "ready" || !sexpr}
                className="text-xs px-2 py-1 border rounded hover:bg-background transition-colors disabled:opacity-50"
              >
                Copy
              </button>
            </div>
            {sexprStatus === "error" ? (
              <div
                role="alert"
                className="text-sm bg-background border rounded p-4 flex flex-wrap items-center gap-3"
              >
                <span className="text-muted-foreground">
                  Couldn&apos;t load the S-expression.
                </span>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="text-xs px-2 py-1 border rounded hover:bg-muted/50 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <pre
                aria-busy={sexprStatus === "loading"}
                className="text-xs font-mono bg-background border rounded p-4 overflow-x-auto max-h-96 overflow-y-auto"
              >
                {sexprStatus === "loading" ? "Loading..." : sexpr}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="bg-muted/50 px-4 py-3 border-t text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> Use the interactive viewer above to explore the
          circuit. Click &quot;Copy to Clipboard&quot; button on the main page
          to get this circuit with attribution, then paste directly into your
          KiCad project (Ctrl+V).
        </p>
      </div>
    </div>
  );
}
