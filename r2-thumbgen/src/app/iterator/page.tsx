'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CircuitWithUser, fetchAllCircuits, fetchCircuitById, CircuitDetail } from '@/lib/supabase';
import { KiCanvas } from '@/components/KiCanvas';
import { captureBothThumbnails, CapturedThumbnails } from '@/lib/thumbnail';

const KICANVAS_HEIGHT = '400px';

interface BenchmarkResult {
  circuitId: string;
  title: string;
  light: string | null;
  dark: string | null;
  time: number;
}

interface UploadResult {
  circuitId: string;
  title: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  urls?: { light?: string; dark?: string };
}

interface R2Status {
  circuitId: string;
  hasR2Thumbnails: boolean;
  light: { exists: boolean; url?: string; size?: number };
  dark: { exists: boolean; url?: string; size?: number };
}

export default function CircuitIterator() {
  const [circuits, setCircuits] = useState<CircuitWithUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current circuit detail
  const [currentDetail, setCurrentDetail] = useState<CircuitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // R2 status - now using a Set for fast lookups
  const [completeCircuitIds, setCompleteCircuitIds] = useState<Set<string>>(new Set());
  const [r2ListLoading, setR2ListLoading] = useState(true);
  const [currentR2Status, setCurrentR2Status] = useState<R2Status | null>(null);
  const [r2Checking, setR2Checking] = useState(false);

  // Capture state
  const [captured, setCaptured] = useState<CapturedThumbnails | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Benchmark state
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchProgress, setBenchProgress] = useState(0);
  const [benchTotal, setBenchTotal] = useState(0);
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([]);

  // Upload state
  const [uploadRunning, setUploadRunning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);

  // Stop control
  const stopRef = useRef(false);

  // Check R2 for a single circuit
  const checkR2Status = useCallback(async (circuitId: string): Promise<R2Status | null> => {
    try {
      const response = await fetch(`/api/check-r2-thumbnail?circuitId=${circuitId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.error('Failed to check R2 status:', err);
      return null;
    }
  }, []);

  // Load all circuits and R2 status on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setR2ListLoading(true);

        // Load circuits and R2 list in parallel
        const [allCircuits, r2Response] = await Promise.all([
          fetchAllCircuits(),
          fetch('/api/list-r2-thumbnails').then((r) => r.json()),
        ]);

        setCircuits(allCircuits);

        if (r2Response.completeCircuitIds) {
          setCompleteCircuitIds(new Set(r2Response.completeCircuitIds));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load circuits');
      } finally {
        setLoading(false);
        setR2ListLoading(false);
      }
    }
    loadData();
  }, []);

  // Refresh R2 list
  const refreshR2List = useCallback(async () => {
    setR2ListLoading(true);
    try {
      const response = await fetch('/api/list-r2-thumbnails');
      const data = await response.json();
      if (data.completeCircuitIds) {
        setCompleteCircuitIds(new Set(data.completeCircuitIds));
      }
    } catch (err) {
      console.error('Failed to refresh R2 list:', err);
    } finally {
      setR2ListLoading(false);
    }
  }, []);

  // Load current circuit detail and R2 status when index changes
  useEffect(() => {
    if (circuits.length === 0) return;

    const circuit = circuits[currentIndex];
    if (!circuit) return;

    async function loadDetail() {
      setDetailLoading(true);
      setCaptured(null);
      setCurrentR2Status(null);
      try {
        const detail = await fetchCircuitById(circuit.id);
        setCurrentDetail(detail);
      } catch (err) {
        console.error('Failed to load circuit detail:', err);
        setCurrentDetail(null);
      } finally {
        setDetailLoading(false);
      }
    }

    async function loadR2Status() {
      setR2Checking(true);
      try {
        const status = await checkR2Status(circuit.id);
        if (status) {
          setCurrentR2Status(status);
        }
      } finally {
        setR2Checking(false);
      }
    }

    loadDetail();
    loadR2Status();
  }, [currentIndex, circuits, checkR2Status]);

  // Check if circuit has R2 thumbnails (instant lookup from Set)
  const hasR2Thumbnails = useCallback(
    (circuitId: string) => {
      return completeCircuitIds.has(circuitId);
    },
    [completeCircuitIds]
  );

  // Find next circuit without R2 thumbnails (instant, no API calls)
  const findNextWithoutR2Thumbs = useCallback(
    (startIndex: number) => {
      for (let i = startIndex; i < circuits.length; i++) {
        if (!completeCircuitIds.has(circuits[i].id)) {
          return i;
        }
      }
      return -1;
    },
    [circuits, completeCircuitIds]
  );

  // Skip to next without R2 thumbs
  const skipToNextWithoutR2Thumbs = useCallback(() => {
    const nextIndex = findNextWithoutR2Thumbs(currentIndex + 1);
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, findNextWithoutR2Thumbs]);

  // Capture current circuit
  const captureCurrentCircuit = useCallback(async (): Promise<CapturedThumbnails | null> => {
    if (!currentDetail || capturing) return null;

    setCapturing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const lightContainer = document.querySelector('[data-capture-light]') as HTMLDivElement;
      const darkContainer = document.querySelector('[data-capture-dark]') as HTMLDivElement;

      if (lightContainer && darkContainer) {
        const result = await captureBothThumbnails(lightContainer, darkContainer);
        setCaptured(result);
        return result;
      }
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setCapturing(false);
    }
    return null;
  }, [currentDetail, capturing]);

  // Upload thumbnails to R2
  const uploadThumbnails = useCallback(
    async (
      circuitId: string,
      thumbnails: CapturedThumbnails
    ): Promise<{ success: boolean; urls?: { light?: string; dark?: string }; error?: string }> => {
      try {
        const response = await fetch('/api/upload-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            circuitId,
            lightDataUrl: thumbnails.light,
            darkDataUrl: thumbnails.dark,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error };
        }

        return { success: true, urls: data.urls };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
      }
    },
    []
  );

  // Verify upload by checking R2 and update the set
  const verifyUpload = useCallback(
    async (circuitId: string) => {
      const status = await checkR2Status(circuitId);
      if (status) {
        setCurrentR2Status(status);
        // Add to the complete set if both exist
        if (status.hasR2Thumbnails) {
          setCompleteCircuitIds((prev) => new Set(Array.from(prev).concat(circuitId)));
        }
      }
      return status;
    },
    [checkR2Status]
  );

  // Capture and upload single circuit
  const captureAndUpload = useCallback(async () => {
    if (!currentDetail) return;

    const thumbnails = await captureCurrentCircuit();
    if (!thumbnails) return;

    const result = await uploadThumbnails(currentDetail.id, thumbnails);

    // Verify the upload
    if (result.success) {
      await verifyUpload(currentDetail.id);
    }

    setUploadResults((prev) => [
      ...prev,
      {
        circuitId: currentDetail.id,
        title: circuits[currentIndex].title,
        success: result.success,
        error: result.error,
        urls: result.urls,
      },
    ]);
  }, [currentDetail, captureCurrentCircuit, uploadThumbnails, verifyUpload, circuits, currentIndex]);

  // Stop running operation
  const stopOperation = useCallback(() => {
    stopRef.current = true;
  }, []);

  // Benchmark: capture multiple circuits (no upload)
  const runBench = async (count: number) => {
    if (benchRunning || circuits.length === 0) return;

    stopRef.current = false;
    setBenchRunning(true);
    setBenchProgress(0);
    setBenchTotal(count);
    setBenchResults([]);

    const results: BenchmarkResult[] = [];
    const startIndex = currentIndex;
    const endIndex = Math.min(startIndex + count, circuits.length);

    for (let i = startIndex; i < endIndex; i++) {
      if (stopRef.current) break;

      setCurrentIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const captureStart = performance.now();

      try {
        const lightContainer = document.querySelector('[data-capture-light]') as HTMLDivElement;
        const darkContainer = document.querySelector('[data-capture-dark]') as HTMLDivElement;

        if (lightContainer && darkContainer) {
          const capturedResult = await captureBothThumbnails(lightContainer, darkContainer);
          const captureTime = performance.now() - captureStart;

          results.push({
            circuitId: circuits[i].id,
            title: circuits[i].title,
            light: capturedResult.light,
            dark: capturedResult.dark,
            time: captureTime,
          });

          setBenchProgress(results.length);
          setBenchResults([...results]);
        }
      } catch (err) {
        console.error(`Bench capture failed for ${circuits[i].title}:`, err);
      }
    }

    setBenchRunning(false);
  };

  // Capture and upload multiple circuits
  const runCaptureAndUpload = async (count: number | 'all') => {
    if (uploadRunning || circuits.length === 0) return;

    stopRef.current = false;
    setUploadRunning(true);
    setUploadProgress(0);
    setUploadResults([]);

    const results: UploadResult[] = [];
    let processed = 0;
    const totalToProcess = count === 'all' ? circuits.length - currentIndex : count;
    setUploadTotal(totalToProcess);

    let i = currentIndex;

    while (processed < totalToProcess && i < circuits.length) {
      if (stopRef.current) break;

      const circuit = circuits[i];

      // Skip if has R2 thumbnails and skipExisting is true
      if (skipExisting && hasR2Thumbnails(circuit.id)) {
        results.push({
          circuitId: circuit.id,
          title: circuit.title,
          success: true,
          skipped: true,
        });
        i++;
        processed++;
        setUploadProgress(processed);
        setUploadResults([...results]);
        continue;
      }

      setCurrentIndex(i);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const lightContainer = document.querySelector('[data-capture-light]') as HTMLDivElement;
        const darkContainer = document.querySelector('[data-capture-dark]') as HTMLDivElement;

        if (lightContainer && darkContainer) {
          const thumbnails = await captureBothThumbnails(lightContainer, darkContainer);
          setCaptured(thumbnails);

          const uploadResult = await uploadThumbnails(circuit.id, thumbnails);

          // Verify upload and update set
          if (uploadResult.success) {
            const status = await checkR2Status(circuit.id);
            if (status) {
              setCurrentR2Status(status);
              if (status.hasR2Thumbnails) {
                setCompleteCircuitIds((prev) => new Set(Array.from(prev).concat(circuit.id)));
              }
            }
          }

          results.push({
            circuitId: circuit.id,
            title: circuit.title,
            success: uploadResult.success,
            error: uploadResult.error,
            urls: uploadResult.urls,
          });
        }
      } catch (err) {
        console.error(`Upload failed for ${circuit.title}:`, err);
        results.push({
          circuitId: circuit.id,
          title: circuit.title,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      i++;
      processed++;
      setUploadProgress(processed);
      setUploadResults([...results]);
    }

    setUploadRunning(false);
  };

  // Navigation
  const goToIndex = (index: number) => {
    if (index >= 0 && index < circuits.length) {
      setCurrentIndex(index);
    }
  };

  // Count circuits with/without R2 thumbnails (instant from Set)
  const circuitsWithR2Thumbs = completeCircuitIds.size;
  const circuitsWithoutR2Thumbs = circuits.length - circuitsWithR2Thumbs;

  const isRunning = benchRunning || uploadRunning;

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

  const currentCircuit = circuits[currentIndex];
  const schematicUrl = currentDetail
    ? `/api/schematic/${currentDetail.id}/${currentDetail.slug}.kicad_sch?v=${currentIndex}`
    : null;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Circuit Iterator</h1>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-600">R2: </span>
                <span className="font-medium text-green-600">{circuitsWithR2Thumbs} complete</span>
                <span className="text-gray-400"> / </span>
                <span className="font-medium text-red-600">{circuitsWithoutR2Thumbs} need thumbs</span>
              </div>
              <button
                onClick={refreshR2List}
                disabled={isRunning || r2ListLoading}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                {r2ListLoading ? 'Loading...' : 'Refresh R2'}
              </button>
              <a href="/" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">
                ← Back
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <button
              onClick={() => goToIndex(currentIndex - 1)}
              disabled={currentIndex === 0 || isRunning}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-4">
              <span className="font-medium">
                Circuit {currentIndex + 1} of {circuits.length}
              </span>
              <input
                type="number"
                min={1}
                max={circuits.length}
                value={currentIndex + 1}
                onChange={(e) => goToIndex(parseInt(e.target.value) - 1)}
                disabled={isRunning}
                className="w-24 px-2 py-1 border rounded text-center"
              />
              <button
                onClick={skipToNextWithoutR2Thumbs}
                disabled={isRunning}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300"
              >
                Skip to Missing →
              </button>
            </div>

            <button
              onClick={() => goToIndex(currentIndex + 1)}
              disabled={currentIndex >= circuits.length - 1 || isRunning}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600"
            >
              Next →
            </button>
          </div>

          {/* Options */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipExisting}
                onChange={(e) => setSkipExisting(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4"
              />
              <span className="text-sm">Skip circuits that already have R2 thumbnails</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-24">Capture:</span>
              <button
                onClick={captureCurrentCircuit}
                disabled={capturing || !currentDetail || isRunning}
                className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400 hover:bg-green-600"
              >
                {capturing ? 'Capturing...' : 'Capture 1'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-24">Upload:</span>
              <button
                onClick={captureAndUpload}
                disabled={capturing || !currentDetail || isRunning}
                className="px-4 py-2 bg-indigo-500 text-white rounded disabled:bg-gray-400 hover:bg-indigo-600"
              >
                Capture & Upload 1
              </button>
              <button
                onClick={() => runCaptureAndUpload(10)}
                disabled={isRunning}
                className="px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-gray-400 hover:bg-indigo-700"
              >
                {uploadRunning && uploadTotal === 10 ? `${uploadProgress}/${uploadTotal}...` : 'Capture & Upload 10'}
              </button>
              <button
                onClick={() => runCaptureAndUpload('all')}
                disabled={isRunning}
                className="px-4 py-2 bg-indigo-700 text-white rounded disabled:bg-gray-400 hover:bg-indigo-800"
              >
                {uploadRunning && uploadTotal > 10 ? `${uploadProgress}/${uploadTotal}...` : 'Capture & Upload All'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-24">Benchmark:</span>
              <button
                onClick={() => runBench(10)}
                disabled={isRunning}
                className="px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-400 hover:bg-purple-600"
              >
                {benchRunning && benchTotal === 10 ? `${benchProgress}/${benchTotal}...` : 'Bench 10'}
              </button>
              <button
                onClick={() => runBench(50)}
                disabled={isRunning}
                className="px-4 py-2 bg-purple-600 text-white rounded disabled:bg-gray-400 hover:bg-purple-700"
              >
                {benchRunning && benchTotal === 50 ? `${benchProgress}/${benchTotal}...` : 'Bench 50'}
              </button>
            </div>

            {isRunning && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-sm text-gray-600 w-24"></span>
                <button
                  onClick={stopOperation}
                  className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                >
                  STOP
                </button>
                <span className="text-sm text-gray-600">
                  {benchRunning && `Benchmarking ${benchProgress}/${benchTotal}...`}
                  {uploadRunning && `Uploading ${uploadProgress}/${uploadTotal}...`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Current Circuit */}
        {currentCircuit && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{currentCircuit.title}</h2>
                <p className="text-gray-600">
                  @{currentCircuit.profile.username} •{' '}
                  <span className="font-mono text-sm">{currentCircuit.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r2Checking ? (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    Checking R2...
                  </span>
                ) : currentR2Status?.hasR2Thumbnails ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    In R2
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                    Not in R2
                  </span>
                )}
              </div>
            </div>

            {detailLoading ? (
              <div className="h-[400px] flex items-center justify-center bg-gray-100 rounded">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-2"></div>
                  <p className="text-gray-500">Loading schematic...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* Light Mode */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Light Mode (kicad theme)</div>
                  <div
                    data-capture-light
                    className="border-2 border-gray-300 rounded-lg overflow-hidden"
                  >
                    {schematicUrl ? (
                      <KiCanvas
                        key={`light-${currentCircuit.id}`}
                        src={schematicUrl}
                        theme="kicad"
                        controls="none"
                        height={KICANVAS_HEIGHT}
                      />
                    ) : (
                      <div className="h-[400px] bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-500">Failed to load</p>
                      </div>
                    )}
                  </div>
                  {captured?.light && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-green-700 mb-2">Captured:</div>
                      <img src={captured.light} alt="Light" className="w-full rounded-lg border-2 border-green-400" />
                    </div>
                  )}
                </div>

                {/* Dark Mode */}
                <div>
                  <div className="text-sm font-medium text-gray-400 mb-2">Dark Mode (witchhazel theme)</div>
                  <div
                    data-capture-dark
                    className="border-2 border-gray-600 rounded-lg overflow-hidden bg-gray-900"
                  >
                    {schematicUrl ? (
                      <KiCanvas
                        key={`dark-${currentCircuit.id}`}
                        src={schematicUrl}
                        theme="witchhazel"
                        controls="none"
                        height={KICANVAS_HEIGHT}
                      />
                    ) : (
                      <div className="h-[400px] bg-gray-800 flex items-center justify-center">
                        <p className="text-gray-500">Failed to load</p>
                      </div>
                    )}
                  </div>
                  {captured?.dark && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-green-500 mb-2">Captured:</div>
                      <img src={captured.dark} alt="Dark" className="w-full rounded-lg border-2 border-green-500" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* R2 Preview */}
            {currentR2Status?.hasR2Thumbnails && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">R2 Preview (from Cloudflare R2)</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm font-medium text-blue-700 mb-2">
                      Light ({((currentR2Status.light.size || 0) / 1024).toFixed(1)} KB)
                    </div>
                    <img
                      src={`${currentR2Status.light.url}?t=${Date.now()}`}
                      alt="R2 Light"
                      className="w-full rounded-lg border-2 border-blue-400"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-blue-500 mb-2">
                      Dark ({((currentR2Status.dark.size || 0) / 1024).toFixed(1)} KB)
                    </div>
                    <img
                      src={`${currentR2Status.dark.url}?t=${Date.now()}`}
                      alt="R2 Dark"
                      className="w-full rounded-lg border-2 border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-indigo-900 mb-4">
              Upload Results ({uploadResults.length} processed)
            </h3>

            <div className="grid grid-cols-4 gap-4 text-sm mb-6">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-indigo-600">Uploaded</p>
                <p className="text-2xl font-bold text-green-600">
                  {uploadResults.filter((r) => r.success && !r.skipped).length}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-indigo-600">Skipped</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {uploadResults.filter((r) => r.skipped).length}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-indigo-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {uploadResults.filter((r) => !r.success).length}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-indigo-600">Total</p>
                <p className="text-2xl font-bold text-indigo-900">{uploadResults.length}</p>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-indigo-100 sticky top-0">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResults.map((result, idx) => (
                    <tr key={result.circuitId} className="border-b border-indigo-100">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 truncate max-w-[300px]" title={result.title}>
                        {result.title}
                      </td>
                      <td className="p-2">
                        {result.skipped ? (
                          <span className="text-yellow-600">Skipped (in R2)</span>
                        ) : result.success ? (
                          <span className="text-green-600">Uploaded</span>
                        ) : (
                          <span className="text-red-600">Failed: {result.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Benchmark Results */}
        {benchResults.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">
              Benchmark Results ({benchResults.length} captured)
            </h3>

            <div className="grid grid-cols-3 gap-4 text-sm mb-6">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-purple-600">Average Time</p>
                <p className="text-2xl font-bold text-purple-900">
                  {(benchResults.reduce((a, b) => a + b.time, 0) / benchResults.length).toFixed(0)}ms
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-purple-600">Total Time</p>
                <p className="text-2xl font-bold text-purple-900">
                  {(benchResults.reduce((a, b) => a + b.time, 0) / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <p className="text-purple-600">Est. for {circuitsWithoutR2Thumbs}</p>
                <p className="text-2xl font-bold text-purple-900">
                  {(
                    ((benchResults.reduce((a, b) => a + b.time, 0) / benchResults.length) *
                      circuitsWithoutR2Thumbs) /
                    1000 /
                    60
                  ).toFixed(1)}{' '}
                  min
                </p>
              </div>
            </div>

            <div className="border-t border-purple-200 pt-4">
              <h4 className="font-medium text-purple-900 mb-4">Thumbnails ({benchResults.length * 2})</h4>
              <div className="grid grid-cols-4 gap-4 max-h-[500px] overflow-y-auto">
                {benchResults.map((result, idx) => (
                  <div key={result.circuitId} className="bg-white rounded-lg p-3 border border-purple-200">
                    <p className="text-sm text-purple-800 truncate font-medium mb-2" title={result.title}>
                      {idx + 1}. {result.title}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {result.light && (
                        <img src={result.light} alt="Light" className="w-full rounded border border-gray-300" />
                      )}
                      {result.dark && (
                        <img src={result.dark} alt="Dark" className="w-full rounded border border-gray-600" />
                      )}
                    </div>
                    <p className="text-xs text-purple-500 mt-2">{result.time.toFixed(0)}ms</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
