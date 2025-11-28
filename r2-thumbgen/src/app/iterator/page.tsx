'use client';

import { useEffect, useState, useRef } from 'react';
import { CircuitWithUser, fetchAllCircuits, fetchCircuitById, CircuitDetail } from '@/lib/supabase';
import { KiCanvas } from '@/components/KiCanvas';
import { captureBothThumbnails, CapturedThumbnails } from '@/lib/thumbnail';

export default function CircuitIterator() {
  const [circuits, setCircuits] = useState<CircuitWithUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCircuit, setCurrentCircuit] = useState<CircuitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedThumbnails, setCapturedThumbnails] = useState<CapturedThumbnails | null>(null);

  // Benchmark state
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<number[]>([]);
  const [benchmarkCount, setBenchmarkCount] = useState(5);
  const [benchmarkThumbnails, setBenchmarkThumbnails] = useState<Array<{
    circuitId: string;
    title: string;
    light: string | null;
    dark: string | null;
    time: number;
  }>>([]);

  // Refs for KiCanvas containers
  const lightCanvasRef = useRef<HTMLDivElement>(null);
  const darkCanvasRef = useRef<HTMLDivElement>(null);

  // Load all circuits on mount
  useEffect(() => {
    async function loadCircuits() {
      try {
        setLoading(true);
        const allCircuits = await fetchAllCircuits();
        setCircuits(allCircuits);
        if (allCircuits.length > 0) {
          // Load first circuit detail
          const detail = await fetchCircuitById(allCircuits[0].id);
          setCurrentCircuit(detail);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
      } finally {
        setLoading(false);
      }
    }

    loadCircuits();
  }, []);

  // Load circuit detail when index changes
  useEffect(() => {
    if (circuits.length === 0) return;

    async function loadCircuitDetail() {
      try {
        const circuit = circuits[currentIndex];
        const detail = await fetchCircuitById(circuit.id);
        setCurrentCircuit(detail);
        // Clear captured thumbnails when switching circuits
        setCapturedThumbnails(null);
      } catch (err) {
        console.error('Failed to load circuit detail:', err);
      }
    }

    loadCircuitDetail();
  }, [currentIndex, circuits]);

  // Capture thumbnails handler - returns timing in ms
  const handleCapture = async (): Promise<number> => {
    if (capturing) return 0;

    const startTime = performance.now();
    setCapturing(true);
    setCapturedThumbnails(null);

    try {
      // Wait a moment for KiCanvas to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      const thumbnails = await captureBothThumbnails(
        lightCanvasRef.current,
        darkCanvasRef.current
      );

      setCapturedThumbnails(thumbnails);
      const elapsed = performance.now() - startTime;
      console.log(`[Iterator] Capture complete in ${elapsed.toFixed(0)}ms`);
      return elapsed;
    } catch (err) {
      console.error('[Iterator] Capture failed:', err);
      return 0;
    } finally {
      setCapturing(false);
    }
  };

  // Benchmark handler - captures N circuits and calculates average time
  const handleBenchmark = async () => {
    if (benchmarking || circuits.length === 0) return;

    setBenchmarking(true);
    setBenchmarkResults([]);
    setBenchmarkThumbnails([]);
    const results: number[] = [];
    const thumbs: typeof benchmarkThumbnails = [];
    const startIndex = currentIndex;

    for (let i = 0; i < benchmarkCount && (startIndex + i) < circuits.length; i++) {
      // Navigate to next circuit if not first
      if (i > 0) {
        setCurrentIndex(startIndex + i);
        // Wait for circuit to load and KiCanvas to render
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // First one - just wait for render
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Capture and measure
      const startTime = performance.now();
      setCapturing(true);
      setCapturedThumbnails(null);

      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const captured = await captureBothThumbnails(
          lightCanvasRef.current,
          darkCanvasRef.current
        );
        const elapsed = performance.now() - startTime;

        setCapturedThumbnails(captured);
        results.push(elapsed);
        setBenchmarkResults([...results]);

        // Store thumbnail for gallery
        const circuit = circuits[startIndex + i];
        thumbs.push({
          circuitId: circuit.id,
          title: circuit.title,
          light: captured.light,
          dark: captured.dark,
          time: elapsed,
        });
        setBenchmarkThumbnails([...thumbs]);

        console.log(`[Benchmark ${i + 1}/${benchmarkCount}] ${circuit.title}: ${elapsed.toFixed(0)}ms`);
      } catch (err) {
        console.error('[Benchmark] Capture failed:', err);
      } finally {
        setCapturing(false);
      }
    }

    setBenchmarking(false);

    // Calculate and log summary
    if (results.length > 0) {
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const totalCircuits = 4298;
      const estimatedTotalMs = avg * totalCircuits;
      const estimatedTotalMinutes = estimatedTotalMs / 1000 / 60;
      const estimatedTotalHours = estimatedTotalMinutes / 60;

      console.log('=== BENCHMARK RESULTS ===');
      console.log(`Samples: ${results.length}`);
      console.log(`Average per circuit: ${avg.toFixed(0)}ms`);
      console.log(`Total circuits: ${totalCircuits}`);
      console.log(`Estimated total time: ${estimatedTotalMinutes.toFixed(1)} minutes (${estimatedTotalHours.toFixed(2)} hours)`);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, circuits.length]);

  const goToNext = () => {
    if (currentIndex < circuits.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToIndex = (index: number) => {
    if (index >= 0 && index < circuits.length) {
      setCurrentIndex(index);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading circuits...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (circuits.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>No circuits found</div>
      </div>
    );
  }

  if (!currentCircuit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading circuit...</div>
      </div>
    );
  }

  // Create API URL for the schematic
  // KiCanvas needs the URL to end with .kicad_sch extension
  // Add cache-busting parameter to force fresh request
  const schematicUrl = `/api/schematic/${currentCircuit.id}/${currentCircuit.slug}.kicad_sch?v=${Date.now()}`;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">{currentCircuit.title}</h1>
            <div className="flex gap-2">
              <a
                href={`https://circuitsnips.com/circuit/${currentCircuit.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors flex items-center gap-2"
              >
                View on CircuitSnips ↗
              </a>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                ← Back to List
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Slug: <code className="bg-gray-100 px-2 py-0.5 rounded">{currentCircuit.slug}</code></span>
            <span>•</span>
            <span>User: {currentCircuit.profile.username}</span>
            <span>•</span>
            <span>Created: {new Date(currentCircuit.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-4">
              <span className="text-sm">
                Circuit {currentIndex + 1} of {circuits.length}
              </span>
              <input
                type="number"
                min="1"
                max={circuits.length}
                value={currentIndex + 1}
                onChange={(e) => goToIndex(parseInt(e.target.value) - 1)}
                className="w-20 px-2 py-1 border rounded text-center"
              />
              <button
                onClick={handleCapture}
                disabled={capturing || benchmarking}
                className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-600 transition-colors font-medium"
              >
                {capturing ? 'Capturing...' : 'Capture for R2'}
              </button>
              <button
                onClick={handleBenchmark}
                disabled={capturing || benchmarking}
                className="px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors font-medium"
              >
                {benchmarking ? `Benchmarking (${benchmarkResults.length}/${benchmarkCount})...` : `Benchmark ${benchmarkCount}`}
              </button>
            </div>

            <button
              onClick={goToNext}
              disabled={currentIndex === circuits.length - 1}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Schematics and Thumbnails */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 gap-4">
          {/* Light Mode Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold bg-white rounded-lg shadow p-3">Light Mode</h2>

            {/* KiCanvas Light */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-2">KiCanvas Preview (kicad theme)</h3>
              <div ref={lightCanvasRef} className="border-2 border-gray-200 rounded">
                <KiCanvas
                  key={`light-${currentCircuit.id}`}
                  src={schematicUrl}
                  theme="kicad"
                  controls="full"
                  height="400px"
                />
              </div>
            </div>

            {/* Existing Thumbnail Light */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-2">Existing Thumbnail (Supabase)</h3>
              {currentCircuit.thumbnail_light_url ? (
                <img
                  src={currentCircuit.thumbnail_light_url}
                  alt="Light thumbnail"
                  className="w-full border-2 border-gray-200 rounded"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 border-2 border-gray-200 rounded flex items-center justify-center text-gray-500">
                  No thumbnail
                </div>
              )}
            </div>

            {/* R2 Captured Thumbnail Light */}
            <div className="bg-white rounded-lg shadow p-4 border-2 border-green-300">
              <h3 className="font-medium mb-2 text-green-700">R2 Thumbnail (Captured)</h3>
              {capturedThumbnails?.light ? (
                <img
                  src={capturedThumbnails.light}
                  alt="R2 Light thumbnail"
                  className="w-full border-2 border-green-200 rounded"
                />
              ) : (
                <div className="w-full h-64 bg-green-50 border-2 border-green-200 rounded flex items-center justify-center text-green-500">
                  {capturing ? 'Capturing...' : 'Click "Capture for R2" to generate'}
                </div>
              )}
            </div>
          </div>

          {/* Dark Mode Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold bg-gray-800 text-white rounded-lg shadow p-3">Dark Mode</h2>

            {/* KiCanvas Dark */}
            <div className="bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-medium mb-2 text-white">KiCanvas Preview (witchhazel theme)</h3>
              <div ref={darkCanvasRef} className="border-2 border-gray-600 rounded">
                <KiCanvas
                  key={`dark-${currentCircuit.id}`}
                  src={schematicUrl}
                  theme="witchhazel"
                  controls="full"
                  height="400px"
                />
              </div>
            </div>

            {/* Existing Thumbnail Dark */}
            <div className="bg-gray-800 rounded-lg shadow p-4">
              <h3 className="font-medium mb-2 text-white">Existing Thumbnail (Supabase)</h3>
              {currentCircuit.thumbnail_dark_url ? (
                <img
                  src={currentCircuit.thumbnail_dark_url}
                  alt="Dark thumbnail"
                  className="w-full border-2 border-gray-600 rounded"
                />
              ) : (
                <div className="w-full h-64 bg-gray-900 border-2 border-gray-600 rounded flex items-center justify-center text-gray-500">
                  No thumbnail
                </div>
              )}
            </div>

            {/* R2 Captured Thumbnail Dark */}
            <div className="bg-gray-800 rounded-lg shadow p-4 border-2 border-green-500">
              <h3 className="font-medium mb-2 text-green-400">R2 Thumbnail (Captured)</h3>
              {capturedThumbnails?.dark ? (
                <img
                  src={capturedThumbnails.dark}
                  alt="R2 Dark thumbnail"
                  className="w-full border-2 border-green-600 rounded"
                />
              ) : (
                <div className="w-full h-64 bg-gray-900 border-2 border-green-700 rounded flex items-center justify-center text-green-500">
                  {capturing ? 'Capturing...' : 'Click "Capture for R2" to generate'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* S-Expression Preview */}
      <div className="max-w-7xl mx-auto mt-4">
        <div className="bg-white rounded-lg shadow">
          <details className="group">
            <summary className="cursor-pointer p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">S-Expression Preview</h3>
                <p className="text-sm text-gray-600">View the raw KiCad schematic data</p>
              </div>
              <svg
                className="w-5 h-5 transform group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Length: {currentCircuit.raw_sexpr.length.toLocaleString()} characters
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentCircuit.raw_sexpr);
                    alert('S-expression copied to clipboard!');
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
              <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto whitespace-pre">
                {currentCircuit.raw_sexpr}
              </pre>
            </div>
          </details>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="max-w-7xl mx-auto mt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <strong>Tip:</strong> Use arrow keys to navigate (← Previous, → Next)
        </div>
      </div>

      {/* Benchmark Results */}
      {benchmarkResults.length > 0 && (
        <div className="max-w-7xl mx-auto mt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Benchmark Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-purple-700">Samples: <strong>{benchmarkResults.length}</strong></p>
                <p className="text-purple-700">
                  Average per circuit: <strong>{(benchmarkResults.reduce((a, b) => a + b, 0) / benchmarkResults.length).toFixed(0)}ms</strong>
                </p>
                <p className="text-purple-700">
                  Individual times: {benchmarkResults.map(r => `${r.toFixed(0)}ms`).join(', ')}
                </p>
              </div>
              <div>
                <p className="text-purple-700">Total circuits: <strong>4,298</strong></p>
                <p className="text-purple-700">
                  Estimated total: <strong>
                    {(() => {
                      const avg = benchmarkResults.reduce((a, b) => a + b, 0) / benchmarkResults.length;
                      const totalMs = avg * 4298;
                      const hours = totalMs / 1000 / 60 / 60;
                      const minutes = totalMs / 1000 / 60;
                      return hours >= 1
                        ? `${hours.toFixed(1)} hours`
                        : `${minutes.toFixed(0)} minutes`;
                    })()}
                  </strong>
                </p>
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {benchmarkThumbnails.length > 0 && (
              <div className="border-t border-purple-200 pt-4">
                <h4 className="font-medium text-purple-900 mb-3">Captured Thumbnails ({benchmarkThumbnails.length * 2} total)</h4>
                <div className="grid grid-cols-5 gap-3">
                  {benchmarkThumbnails.map((thumb, idx) => (
                    <div key={thumb.circuitId} className="space-y-2">
                      <p className="text-xs text-purple-700 truncate font-medium" title={thumb.title}>
                        {idx + 1}. {thumb.title}
                      </p>
                      <div className="space-y-1">
                        {thumb.light && (
                          <img
                            src={thumb.light}
                            alt={`${thumb.title} light`}
                            className="w-full rounded border border-gray-300"
                          />
                        )}
                        {thumb.dark && (
                          <img
                            src={thumb.dark}
                            alt={`${thumb.title} dark`}
                            className="w-full rounded border border-gray-600"
                          />
                        )}
                      </div>
                      <p className="text-xs text-purple-500">{thumb.time.toFixed(0)}ms</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
