"use client";

import { useState, useEffect, useRef } from "react";
import { Loader, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { captureThumbnails } from "@/lib/thumbnail";
import { removeHierarchicalSheets } from "@/lib/kicad-parser";

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

interface Circuit {
  id: string;
  slug: string;
  title: string;
  user_id: string;
  raw_sexpr: string;
  thumbnail_light_url: string | null;
  thumbnail_dark_url: string | null;
}

interface ProcessingResult {
  circuitId: string;
  title: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  lightUrl?: string;
  darkUrl?: string;
}

/**
 * UTF-8 safe base64 encoding
 * Handles Unicode characters that btoa() cannot process
 */
function utf8ToBase64(str: string): string {
  try {
    // Convert string to UTF-8 bytes
    const utf8Bytes = new TextEncoder().encode(str);
    // Convert bytes to binary string
    let binaryString = '';
    utf8Bytes.forEach(byte => {
      binaryString += String.fromCharCode(byte);
    });
    // Encode to base64
    return btoa(binaryString);
  } catch (error) {
    console.error('Error encoding to base64:', error);
    throw new Error('Failed to encode circuit data');
  }
}

export function ThumbnailRegenerator() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedCircuits, setSelectedCircuits] = useState<Set<string>>(new Set());
  const [previewCircuitId, setPreviewCircuitId] = useState<string | null>(null);
  const kicanvasRef = useRef<HTMLDivElement>(null);

  // Fetch all circuits from circuitsnips-importer user
  useEffect(() => {
    const fetchCircuits = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        // First, get the circuitsnips-importer user ID
        const { data: importerUser, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', 'circuitsnips-importer')
          .single();

        if (userError) {
          console.error('Error fetching importer user:', userError);
          throw userError;
        }

        if (!importerUser) {
          console.log('No circuitsnips-importer user found');
          setCircuits([]);
          setResults([]);
          setIsLoading(false);
          return;
        }

        // Fetch all circuits from circuitsnips-importer
        const { data, error } = await supabase
          .from('circuits')
          .select('id, slug, title, user_id, raw_sexpr, thumbnail_light_url, thumbnail_dark_url')
          .eq('user_id', importerUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching circuits:', error);
          throw error;
        }

        setCircuits(data || []);
        setResults((data || []).map(c => ({
          circuitId: c.id,
          title: c.title,
          status: 'pending'
        })));
      } catch (error) {
        console.error('Failed to fetch circuits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCircuits();
  }, []);

  const processCircuit = async (circuit: Circuit, index: number) => {
    // Update status to processing
    setResults(prev => prev.map((r, i) =>
      i === index ? { ...r, status: 'processing' } : r
    ));

    try {
      // Validate the circuit data is a valid KiCad S-expression
      const trimmedData = circuit.raw_sexpr.trim();

      // Check if it starts with HTML (corrupted data)
      if (trimmedData.startsWith('<!DOCTYPE') || trimmedData.startsWith('<html') || trimmedData.startsWith('<?xml')) {
        throw new Error('Circuit contains corrupted data (HTML/XML instead of schematic)');
      }

      // Check if it starts with a valid S-expression
      if (!trimmedData.startsWith('(kicad_sch') && !trimmedData.startsWith('(')) {
        throw new Error('Circuit data is not a valid KiCad S-expression');
      }

      // Validate the circuit data can be encoded
      try {
        utf8ToBase64(circuit.raw_sexpr);
      } catch (encodeError) {
        throw new Error('Circuit contains invalid characters for encoding');
      }

      // Wait for KiCanvas to fully render and stabilize
      await new Promise(resolve => setTimeout(resolve, 3500));

      const kicanvasElement = kicanvasRef.current?.querySelector('kicanvas-embed') as HTMLElement;
      if (!kicanvasElement) {
        throw new Error('KiCanvas element not found - viewer may not have loaded');
      }

      // Check if KiCanvas has actually rendered content
      const kicanvasContent = kicanvasElement.shadowRoot;
      if (!kicanvasContent) {
        throw new Error('KiCanvas shadow DOM not initialized');
      }

      // Capture thumbnails in both themes
      let thumbnailResult;
      try {
        thumbnailResult = await captureThumbnails(
          kicanvasElement,
          theme,
          setTheme
        );
      } catch (captureError: any) {
        // Check if it's a KiCanvas parsing error
        if (captureError.message?.includes('Unexpected character')) {
          throw new Error('KiCanvas failed to parse circuit data - data may be corrupted');
        }
        throw captureError;
      }

      if (!thumbnailResult.light || !thumbnailResult.dark) {
        throw new Error('Failed to capture thumbnails');
      }

      // Get access token for admin API call
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Upload thumbnails via admin API
      const response = await fetch('/api/admin/regenerate-thumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          circuitId: circuit.id,
          userId: circuit.user_id,
          lightThumbBase64: thumbnailResult.light,
          darkThumbBase64: thumbnailResult.dark,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload thumbnails');
      }

      const result = await response.json();

      // Update status to success
      setResults(prev => prev.map((r, i) =>
        i === index ? {
          ...r,
          status: 'success',
          lightUrl: result.lightUrl,
          darkUrl: result.darkUrl
        } : r
      ));

    } catch (error: any) {
      console.error(`Error processing circuit ${circuit.id}:`, error);
      setResults(prev => prev.map((r, i) =>
        i === index ? {
          ...r,
          status: 'error',
          error: error.message || 'Unknown error'
        } : r
      ));
    }
  };

  const startBatchProcessing = async () => {
    const circuitsToProcess = selectedCircuits.size > 0
      ? circuits.filter(c => selectedCircuits.has(c.id))
      : circuits;

    if (circuitsToProcess.length === 0) {
      alert('Please select circuits to process');
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(0);

    for (let i = 0; i < circuits.length; i++) {
      if (selectedCircuits.size > 0 && !selectedCircuits.has(circuits[i].id)) {
        continue; // Skip unselected circuits
      }
      setCurrentIndex(i);
      await processCircuit(circuits[i], i);
    }

    setIsProcessing(false);
  };

  const toggleSelectAll = () => {
    if (selectedCircuits.size === circuits.length) {
      setSelectedCircuits(new Set());
    } else {
      setSelectedCircuits(new Set(circuits.map(c => c.id)));
    }
  };

  const toggleSelectCircuit = (circuitId: string) => {
    const newSelected = new Set(selectedCircuits);
    if (newSelected.has(circuitId)) {
      newSelected.delete(circuitId);
    } else {
      newSelected.add(circuitId);
    }
    setSelectedCircuits(newSelected);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading circuits...</p>
      </div>
    );
  }

  if (circuits.length === 0) {
    return (
      <div className="text-center py-12 bg-card border rounded-lg">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">No circuits found</h3>
        <p className="text-muted-foreground">
          No circuits found from circuitsnips-importer user.
        </p>
      </div>
    );
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;
  const withThumbnails = circuits.filter(c => c.thumbnail_light_url && c.thumbnail_dark_url).length;
  const withoutThumbnails = circuits.length - withThumbnails;

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Thumbnail Regeneration</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Showing all circuits from @circuitsnips-importer
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{circuits.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">With Thumbnails</p>
            <p className="text-2xl font-bold text-blue-500">{withThumbnails}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Missing</p>
            <p className="text-2xl font-bold text-orange-500">{withoutThumbnails}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Success</p>
            <p className="text-2xl font-bold text-green-500">{successCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-500">{errorCount}</p>
          </div>
        </div>

        {/* Select All Checkbox */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-md border">
          <input
            type="checkbox"
            checked={selectedCircuits.size === circuits.length && circuits.length > 0}
            onChange={toggleSelectAll}
            className="w-5 h-5 rounded border-2 border-primary cursor-pointer"
          />
          <span className="font-medium">
            {selectedCircuits.size === 0
              ? 'Select All'
              : `${selectedCircuits.size} of ${circuits.length} selected`}
          </span>
        </div>

        <button
          onClick={startBatchProcessing}
          disabled={isProcessing}
          className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing
            ? `Processing ${currentIndex + 1} of ${circuits.length}...`
            : selectedCircuits.size > 0
            ? `Process ${selectedCircuits.size} Selected Circuit${selectedCircuits.size > 1 ? 's' : ''}`
            : 'Process All Circuits'}
        </button>
      </div>

      {/* Progress List */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Processing Queue</h3>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {results.map((result, index) => (
            <div key={result.circuitId} className="space-y-0">
              <div
                className={`flex items-center gap-3 p-3 rounded-md border ${
                  index === currentIndex && isProcessing ? 'bg-primary/10 border-primary' : ''
                }`}
              >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedCircuits.has(result.circuitId)}
                onChange={() => toggleSelectCircuit(result.circuitId)}
                disabled={isProcessing}
                className="w-5 h-5 rounded border-2 border-primary cursor-pointer flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {/* Status Icon */}
              <div className="flex-shrink-0">
                {result.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-muted" />
                )}
                {result.status === 'processing' && (
                  <Loader className="w-5 h-5 animate-spin text-primary" />
                )}
                {result.status === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {result.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>

              {/* Title, Error, and Thumbnail Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{result.title}</p>
                  {circuits[index] && circuits[index].thumbnail_light_url && circuits[index].thumbnail_dark_url ? (
                    <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-500 rounded flex-shrink-0">
                      Has Thumbnails
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-orange-500/10 text-orange-500 rounded flex-shrink-0">
                      Missing
                    </span>
                  )}
                </div>
                {result.error && (
                  <p className="text-xs text-red-500 mt-1">{result.error}</p>
                )}
              </div>

              {/* Preview and Index */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setPreviewCircuitId(previewCircuitId === result.circuitId ? null : result.circuitId)}
                  disabled={isProcessing}
                  className="px-2 py-1 text-xs border rounded hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewCircuitId === result.circuitId ? 'Hide' : 'Preview'}
                </button>
                <span className="text-sm text-muted-foreground">
                  {index + 1}/{results.length}
                </span>
              </div>
              </div>

              {/* Preview Panel */}
              {previewCircuitId === result.circuitId && (
                <div className="mt-3 p-4 border-t bg-muted/20">
                  <h4 className="text-sm font-semibold mb-2">Circuit Preview</h4>
                  <div className="rounded-md overflow-hidden border-2 border-muted bg-background" style={{ height: '400px' }}>
                    <kicanvas-embed
                      src={`data:application/x-kicad-schematic;base64,${utf8ToBase64(removeHierarchicalSheets(circuits[index].raw_sexpr))}`}
                      controls="full"
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This is the same view that will be captured for the thumbnail.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hidden KiCanvas Renderer - Uses opacity instead of display:none to maintain dimensions */}
      {isProcessing && currentIndex < circuits.length && (
        <div className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" style={{ width: '800px', height: '600px' }}>
          <div ref={kicanvasRef} style={{ width: '100%', height: '100%' }}>
            <kicanvas-embed
              id="thumbnail-kicanvas"
              controls="basic"
              src={`data:application/x-kicad-schematic;base64,${utf8ToBase64(removeHierarchicalSheets(circuits[currentIndex].raw_sexpr))}`}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
