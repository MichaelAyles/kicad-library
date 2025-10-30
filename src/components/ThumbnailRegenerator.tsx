"use client";

import { useState, useEffect, useRef } from "react";
import { Loader, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { captureThumbnails } from "@/lib/thumbnail";
import { KiCanvas, KiCanvasCard } from "@/components/KiCanvas";

interface Circuit {
  id: string;
  slug: string;
  title: string;
  user_id: string;
  raw_sexpr?: string; // Make optional, load lazily
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


export function ThumbnailRegenerator() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedCircuits, setSelectedCircuits] = useState<Set<string>>(new Set());
  const [previewCircuitId, setPreviewCircuitId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [withThumbnailsCount, setWithThumbnailsCount] = useState(0);
  const [withoutThumbnailsCount, setWithoutThumbnailsCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 100;
  const kicanvasRef = useRef<HTMLDivElement>(null);

  // Fetch thumbnail statistics from database
  const fetchThumbnailStats = async (importerUserId: string) => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Get count with thumbnails
      const { count: withThumbsCount } = await supabase
        .from('circuits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', importerUserId)
        .not('thumbnail_light_url', 'is', null)
        .not('thumbnail_dark_url', 'is', null);

      // Get count without thumbnails
      const { count: withoutThumbsCount } = await supabase
        .from('circuits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', importerUserId)
        .or('thumbnail_light_url.is.null,thumbnail_dark_url.is.null');

      setWithThumbnailsCount(withThumbsCount || 0);
      setWithoutThumbnailsCount(withoutThumbsCount || 0);
    } catch (error) {
      console.error('Error fetching thumbnail stats:', error);
    }
  };

  // Fetch circuits from circuitsnips-importer user (paginated, without raw_sexpr)
  useEffect(() => {
    const fetchInitialCircuits = async () => {
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

        // Get total count
        const { count, error: countError } = await supabase
          .from('circuits')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', importerUser.id);

        if (countError) {
          console.error('Error getting count:', countError);
        } else {
          setTotalCount(count || 0);
        }

        // Fetch thumbnail statistics
        await fetchThumbnailStats(importerUser.id);

        // Fetch first page of circuits WITHOUT raw_sexpr (much lighter)
        const { data, error } = await supabase
          .from('circuits')
          .select('id, slug, title, user_id, thumbnail_light_url, thumbnail_dark_url')
          .eq('user_id', importerUser.id)
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) {
          console.error('Error fetching circuits:', error);
          throw error;
        }

        const circuits = data || [];
        setCircuits(circuits);
        setResults(circuits.map(c => ({
          circuitId: c.id,
          title: c.title,
          status: 'pending'
        })));
        setHasMore(circuits.length === PAGE_SIZE);
      } catch (error) {
        console.error('Failed to fetch circuits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialCircuits();
  }, []);

  // Load more circuits
  const loadMoreCircuits = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Get the importer user ID
      const { data: importerUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'circuitsnips-importer')
        .single();

      if (!importerUser) return;

      // Fetch next page
      const { data, error } = await supabase
        .from('circuits')
        .select('id, slug, title, user_id, thumbnail_light_url, thumbnail_dark_url')
        .eq('user_id', importerUser.id)
        .order('created_at', { ascending: false })
        .range(circuits.length, circuits.length + PAGE_SIZE - 1);

      if (error) {
        console.error('Error loading more circuits:', error);
        throw error;
      }

      const newCircuits = data || [];
      setCircuits(prev => [...prev, ...newCircuits]);
      setResults(prev => [
        ...prev,
        ...newCircuits.map(c => ({
          circuitId: c.id,
          title: c.title,
          status: 'pending' as const
        }))
      ]);
      setHasMore(newCircuits.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load more circuits:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const processCircuit = async (circuit: Circuit, index: number) => {
    // Update status to processing
    setResults(prev => prev.map((r, i) =>
      i === index ? { ...r, status: 'processing' } : r
    ));

    try {
      // Lazy load raw_sexpr if not already loaded
      let raw_sexpr = circuit.raw_sexpr;
      if (!raw_sexpr) {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data, error } = await supabase
          .from('circuits')
          .select('raw_sexpr')
          .eq('id', circuit.id)
          .single();

        if (error || !data || !data.raw_sexpr) {
          throw new Error('Failed to load circuit data');
        }
        raw_sexpr = data.raw_sexpr;
        // Update the circuit in state
        setCircuits(prev => prev.map((c, i) =>
          i === index ? { ...c, raw_sexpr } : c
        ));
      }

      if (!raw_sexpr) {
        throw new Error('Circuit data is missing');
      }

      // Validate the circuit data is a valid KiCad S-expression
      const trimmedData = raw_sexpr.trim();

      // Check if it starts with HTML (corrupted data)
      if (trimmedData.startsWith('<!DOCTYPE') || trimmedData.startsWith('<html') || trimmedData.startsWith('<?xml')) {
        throw new Error('Circuit contains corrupted data (HTML/XML instead of schematic)');
      }

      // Check if it starts with a valid S-expression
      if (!trimmedData.startsWith('(kicad_sch') && !trimmedData.startsWith('(')) {
        throw new Error('Circuit data is not a valid KiCad S-expression');
      }

      // Wait for KiCanvas to fully render and stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

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

    let processed = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < circuits.length; i++) {
      if (selectedCircuits.size > 0 && !selectedCircuits.has(circuits[i].id)) {
        continue; // Skip unselected circuits
      }
      setCurrentIndex(i);
      await processCircuit(circuits[i], i);
      processed++;

      // Track results
      const result = results[i];
      if (result?.status === 'success') successCount++;
      if (result?.status === 'error') errorCount++;
    }

    setIsProcessing(false);
    alert(`Processing complete!\n✅ Success: ${successCount}\n❌ Failed: ${errorCount}\n📊 Total: ${processed}`);

    // Refresh thumbnail statistics from database
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: importerUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', 'circuitsnips-importer')
      .single();

    if (importerUser) {
      await fetchThumbnailStats(importerUser.id);
    }
  };

  const startProcessAllWithoutThumbnails = async () => {
    if (!confirm('This will process ALL circuits without thumbnails from the database. This may take a long time. Continue?')) {
      return;
    }

    setIsProcessing(true);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      // Get the importer user ID
      const { data: importerUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', 'circuitsnips-importer')
        .single();

      if (!importerUser) {
        alert('Could not find circuitsnips-importer user');
        return;
      }

      // Fetch ALL circuits without thumbnails (just metadata, no raw_sexpr)
      const { data: circuitsWithoutThumbs, error } = await supabase
        .from('circuits')
        .select('id, slug, title, user_id')
        .eq('user_id', importerUser.id)
        .or('thumbnail_light_url.is.null,thumbnail_dark_url.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching circuits:', error);
        alert('Failed to fetch circuits without thumbnails');
        return;
      }

      const allCircuits = circuitsWithoutThumbs || [];

      if (allCircuits.length === 0) {
        alert('No circuits without thumbnails found!');
        setIsProcessing(false);
        return;
      }

      alert(`Found ${allCircuits.length} circuits without thumbnails. Starting processing...`);

      // Process each circuit
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < allCircuits.length; i++) {
        const circuit = allCircuits[i];

        // Update current index for UI
        setCurrentIndex(i);

        // Add to results if not already there
        setResults(prev => {
          const exists = prev.find(r => r.circuitId === circuit.id);
          if (exists) return prev;
          return [...prev, {
            circuitId: circuit.id,
            title: circuit.title,
            status: 'pending'
          }];
        });

        // Find the index in results
        const resultIndex = i;

        // Update status to processing
        setResults(prev => prev.map((r, idx) =>
          r.circuitId === circuit.id ? { ...r, status: 'processing' } : r
        ));

        try {
          // Fetch the raw_sexpr for this circuit
          const { data: circuitData, error: fetchError } = await supabase
            .from('circuits')
            .select('raw_sexpr')
            .eq('id', circuit.id)
            .single();

          if (fetchError || !circuitData || !circuitData.raw_sexpr) {
            throw new Error('Failed to load circuit data');
          }

          const raw_sexpr = circuitData.raw_sexpr;

          // Create a temporary circuit object for processing
          const tempCircuit: Circuit = {
            ...circuit,
            raw_sexpr,
            thumbnail_light_url: null,
            thumbnail_dark_url: null
          };

          // Add to circuits state temporarily for KiCanvas rendering
          setCircuits(prev => {
            const exists = prev.find(c => c.id === circuit.id);
            if (exists) return prev;
            return [...prev, tempCircuit];
          });

          // Validate the circuit data
          const trimmedData = raw_sexpr.trim();
          if (trimmedData.startsWith('<!DOCTYPE') || trimmedData.startsWith('<html') || trimmedData.startsWith('<?xml')) {
            throw new Error('Circuit contains corrupted data (HTML/XML instead of schematic)');
          }
          if (!trimmedData.startsWith('(kicad_sch') && !trimmedData.startsWith('(')) {
            throw new Error('Circuit data is not a valid KiCad S-expression');
          }

          // Wait for KiCanvas to render
          await new Promise(resolve => setTimeout(resolve, 2000));

          const kicanvasElement = kicanvasRef.current?.querySelector('kicanvas-embed') as HTMLElement;
          if (!kicanvasElement) {
            throw new Error('KiCanvas element not found');
          }

          const kicanvasContent = kicanvasElement.shadowRoot;
          if (!kicanvasContent) {
            throw new Error('KiCanvas shadow DOM not initialized');
          }

          // Capture thumbnails
          const thumbnailResult = await captureThumbnails(
            kicanvasElement,
            theme,
            setTheme
          );

          if (!thumbnailResult.light || !thumbnailResult.dark) {
            throw new Error('Failed to capture thumbnails');
          }

          // Upload thumbnails
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('Not authenticated');
          }

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
          setResults(prev => prev.map(r =>
            r.circuitId === circuit.id ? {
              ...r,
              status: 'success',
              lightUrl: result.lightUrl,
              darkUrl: result.darkUrl
            } : r
          ));

          successCount++;

        } catch (error: any) {
          console.error(`Error processing circuit ${circuit.id}:`, error);
          setResults(prev => prev.map(r =>
            r.circuitId === circuit.id ? {
              ...r,
              status: 'error',
              error: error.message || 'Unknown error'
            } : r
          ));
          errorCount++;
        }
      }

      alert(`Processing complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`);

      // Refresh thumbnail statistics from database (reuse existing importerUser from line 387)
      if (importerUser) {
        await fetchThumbnailStats(importerUser.id);
      }

    } catch (error: any) {
      console.error('Error in batch processing:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCircuits.size === circuits.length) {
      setSelectedCircuits(new Set());
    } else {
      setSelectedCircuits(new Set(circuits.map(c => c.id)));
    }
  };

  const toggleSelectWithoutThumbnails = () => {
    const withoutThumbnails = circuits.filter(
      c => !c.thumbnail_light_url || !c.thumbnail_dark_url
    );
    setSelectedCircuits(new Set(withoutThumbnails.map(c => c.id)));
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
  // Use database counts for accurate statistics (not just loaded circuits)
  const withThumbnails = withThumbnailsCount;
  const withoutThumbnails = withoutThumbnailsCount;

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Thumbnail Regeneration</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {totalCount > 0
            ? `Loaded ${circuits.length} of ${totalCount} circuits from @circuitsnips-importer`
            : 'Showing all circuits from @circuitsnips-importer'}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{totalCount || circuits.length}</p>
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

        {/* Selection Controls */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border">
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

          <div className="flex gap-2">
            <button
              onClick={toggleSelectAll}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted/50 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={toggleSelectWithoutThumbnails}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted/50 transition-colors bg-orange-500/10 border-orange-500/50 text-orange-600 dark:text-orange-400"
            >
              Select Without Thumbnails ({withoutThumbnails})
            </button>
            <button
              onClick={() => setSelectedCircuits(new Set())}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted/50 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={startProcessAllWithoutThumbnails}
            disabled={isProcessing}
            className="w-full px-6 py-3 bg-orange-600 text-white rounded-md font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Processing {currentIndex + 1}...
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                Process ALL Without Thumbnails (From Entire Database)
              </>
            )}
          </button>

          <div className="text-center text-xs text-muted-foreground">
            OR process only loaded circuits below:
          </div>

          <button
            onClick={startBatchProcessing}
            disabled={isProcessing}
            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? `Processing ${currentIndex + 1} of ${circuits.length}...`
              : selectedCircuits.size > 0
              ? `Process ${selectedCircuits.size} Selected Circuit${selectedCircuits.size > 1 ? 's' : ''} (Loaded Only)`
              : `Process All ${circuits.length} Loaded Circuits`}
          </button>
        </div>
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

              {/* Actions and Index */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* View Thumbnail button - only show if thumbnails exist */}
                {circuits[index] && circuits[index].thumbnail_light_url && circuits[index].thumbnail_dark_url && (
                  <a
                    href={circuits[index].thumbnail_light_url || ''}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs border rounded hover:bg-background transition-colors bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400"
                    title="View thumbnail in new tab"
                  >
                    View Thumb
                  </a>
                )}

                {/* Go to Circuit link */}
                {circuits[index] && (
                  <a
                    href={`/circuit/${circuits[index].slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs border rounded hover:bg-background transition-colors"
                    title="Open circuit page in new tab"
                  >
                    Go to Circuit
                  </a>
                )}

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
                  <KiCanvasCard
                    slug={circuits[index].slug}
                    controls="full"
                    height="400px"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This is the same view that will be captured for the thumbnail.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMore && !isProcessing && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMoreCircuits}
              disabled={isLoadingMore}
              className="px-6 py-3 bg-muted border rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <Loader className="w-4 h-4 animate-spin inline mr-2" />
                  Loading...
                </>
              ) : (
                `Load More (${totalCount - circuits.length} remaining)`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Hidden KiCanvas Renderer - Uses opacity instead of display:none to maintain dimensions */}
      {isProcessing && currentIndex < circuits.length && (
        <div className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" style={{ width: '800px', height: '600px' }}>
          <div ref={kicanvasRef} style={{ width: '100%', height: '100%' }}>
            <KiCanvas
              slug={circuits[currentIndex].slug}
              controls="basic"
              height="100%"
              width="100%"
            />
          </div>
        </div>
      )}
    </div>
  );
}
