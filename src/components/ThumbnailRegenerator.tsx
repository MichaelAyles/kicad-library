"use client";

import { useState, useEffect, useRef } from "react";
import { Loader, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { captureThumbnails } from "@/lib/thumbnail";

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
}

interface ProcessingResult {
  circuitId: string;
  title: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  lightUrl?: string;
  darkUrl?: string;
}

export function ThumbnailRegenerator() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedCircuits, setSelectedCircuits] = useState<Set<string>>(new Set());
  const kicanvasRef = useRef<HTMLDivElement>(null);

  // Fetch circuits without thumbnails
  useEffect(() => {
    const fetchCircuits = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        const { data, error } = await supabase
          .from('circuits')
          .select('id, slug, title, user_id, raw_sexpr')
          .or('thumbnail_light_url.is.null,thumbnail_dark_url.is.null')
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
      // Wait for KiCanvas to fully render and stabilize
      await new Promise(resolve => setTimeout(resolve, 3500));

      const kicanvasElement = kicanvasRef.current?.querySelector('kicanvas-embed') as HTMLElement;
      if (!kicanvasElement) {
        throw new Error('KiCanvas element not found');
      }

      // Capture thumbnails in both themes
      const thumbnailResult = await captureThumbnails(
        kicanvasElement,
        theme,
        setTheme
      );

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
        <h3 className="text-lg font-semibold mb-2">All circuits have thumbnails</h3>
        <p className="text-muted-foreground">
          There are no circuits requiring thumbnail regeneration.
        </p>
      </div>
    );
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Thumbnail Regeneration</h2>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{circuits.length}</p>
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
            <div
              key={result.circuitId}
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

              {/* Title and Error */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{result.title}</p>
                {result.error && (
                  <p className="text-xs text-red-500 mt-1">{result.error}</p>
                )}
              </div>

              {/* Index */}
              <span className="text-sm text-muted-foreground flex-shrink-0">
                {index + 1}/{results.length}
              </span>
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
              src={`data:application/x-kicad-schematic;base64,${btoa(circuits[currentIndex].raw_sexpr)}`}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
