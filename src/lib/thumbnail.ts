/**
 * Thumbnail Generation for KiCanvas Viewer
 *
 * Captures screenshots of two KiCanvas viewers (light and dark themes)
 * Uses native canvas export with html2canvas fallback
 */

import html2canvas from 'html2canvas';

// Configuration constants
export const THUMBNAIL_CONFIG = {
  // A4 Landscape aspect ratio: 297mm x 210mm ≈ 1.414:1
  WIDTH: 800,
  HEIGHT: 566, // 800 / 1.414
  QUALITY: 0.9,
  SCALE: 2, // 2x resolution for higher quality
} as const;

export const RENDER_CONFIG = {
  RENDER_TIMEOUT: 10000, // Max time to wait for render event (ms)
  OVERLAY_DISMISS_WAIT: 100, // Time to wait after dismissing overlay (ms)
  CANVAS_WAIT_ATTEMPTS: 5, // Number of attempts to wait for canvas
  CANVAS_WAIT_DELAY: 200, // Delay between canvas wait attempts (ms)
} as const;

// For backwards compatibility
export const THUMBNAIL_WIDTH = THUMBNAIL_CONFIG.WIDTH;
export const THUMBNAIL_HEIGHT = THUMBNAIL_CONFIG.HEIGHT;

// KiCanvas error color (cyan/teal when rendering fails)
const KICANVAS_ERROR_COLOR = { r: 0, g: 255, b: 255 }; // #00FFFF

export interface ThumbnailResult {
  light: string; // base64 data URL
  dark: string;  // base64 data URL
}

/**
 * Check if a canvas is mostly the KiCanvas cyan error color
 * Returns true if the image appears to be invalid/error state
 */
function isInvalidCapture(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;

  // Sample pixels at various points across the canvas
  const samplePoints = [
    { x: 10, y: 10 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width - 10, y: 10 },
    { x: 10, y: canvas.height - 10 },
    { x: canvas.width - 10, y: canvas.height - 10 },
    { x: canvas.width / 4, y: canvas.height / 4 },
    { x: (canvas.width * 3) / 4, y: (canvas.height * 3) / 4 },
    { x: canvas.width / 3, y: canvas.height / 2 },
    { x: (canvas.width * 2) / 3, y: canvas.height / 2 },
  ];

  let cyanCount = 0;

  for (const point of samplePoints) {
    const pixel = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
    const color = { r: pixel[0], g: pixel[1], b: pixel[2] };

    // Check if this pixel is the cyan error color (with some tolerance)
    // KiCanvas error cyan is exactly #00FFFF (0, 255, 255)
    if (color.r < 20 && color.g > 240 && color.b > 240) {
      cyanCount++;
    }
  }

  // Only flag as invalid if MOST samples are the specific cyan error color
  if (cyanCount >= samplePoints.length - 1) {
    console.log('[Capture] Detected cyan error color - invalid capture');
    return true;
  }

  return false;
}

/**
 * Recursively search for canvas in shadow DOMs (up to maxDepth levels)
 */
function findCanvasInShadowDOM(root: Element | ShadowRoot, depth = 0, maxDepth = 5): HTMLCanvasElement | null {
  if (depth > maxDepth) return null;

  // Check for canvas directly
  const canvas = root.querySelector('canvas');
  if (canvas) {
    console.log(`[FindCanvas] Found canvas at depth ${depth}`);
    return canvas;
  }

  // Search in shadow roots of all elements
  const elements = root.querySelectorAll('*');
  for (const el of Array.from(elements)) {
    if (el.shadowRoot) {
      const found = findCanvasInShadowDOM(el.shadowRoot, depth + 1, maxDepth);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find the canvas element inside kicanvas-embed (may be in shadow DOM)
 */
function findKiCanvasCanvas(kicanvasEmbed: Element): HTMLCanvasElement | null {
  // Try direct child first
  const directCanvas = kicanvasEmbed.querySelector('canvas');
  if (directCanvas) {
    return directCanvas;
  }

  // Try shadow DOM recursively
  if (kicanvasEmbed.shadowRoot) {
    const shadowCanvas = findCanvasInShadowDOM(kicanvasEmbed.shadowRoot, 0);
    if (shadowCanvas) return shadowCanvas;
  }

  // Try to find kicanvas-viewer or kicanvas-schematic inside
  const viewers = ['kicanvas-viewer', 'kicanvas-schematic', 'kicanvas-app'];
  for (const viewerTag of viewers) {
    let viewer = kicanvasEmbed.querySelector(viewerTag);
    if (!viewer && kicanvasEmbed.shadowRoot) {
      viewer = kicanvasEmbed.shadowRoot.querySelector(viewerTag);
    }
    if (viewer) {
      if (viewer.shadowRoot) {
        const viewerCanvas = findCanvasInShadowDOM(viewer.shadowRoot, 0);
        if (viewerCanvas) return viewerCanvas;
      }
    }
  }

  return null;
}

/**
 * Wait for a canvas to be ready with retries
 */
async function waitForCanvas(
  kicanvasEmbed: Element,
  mode: string
): Promise<HTMLCanvasElement | null> {
  for (let attempt = 1; attempt <= RENDER_CONFIG.CANVAS_WAIT_ATTEMPTS; attempt++) {
    const canvas = findKiCanvasCanvas(kicanvasEmbed);
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      console.log(`[Capture] ${mode}: Canvas ready on attempt ${attempt}: ${canvas.width}x${canvas.height}`);
      return canvas;
    }
    console.log(`[Capture] ${mode}: Attempt ${attempt}/${RENDER_CONFIG.CANVAS_WAIT_ATTEMPTS} - canvas not ready yet`);
    await new Promise(resolve => setTimeout(resolve, RENDER_CONFIG.CANVAS_WAIT_DELAY));
  }
  return null;
}

/**
 * Capture a single KiCanvas viewer element using native canvas export
 */
async function captureKiCanvasElement(
  containerElement: HTMLElement,
  mode: 'light' | 'dark' = 'light'
): Promise<string> {
  console.log(`[Capture] Starting ${mode} mode capture...`);

  // Find the kicanvas-embed element
  const kicanvasEmbed = containerElement.querySelector('kicanvas-embed');
  if (!kicanvasEmbed) {
    console.error(`[Capture] ${mode}: kicanvas-embed element not found`);
    throw new Error('kicanvas-embed element not found in container');
  }

  // Try to click to dismiss any overlay
  (kicanvasEmbed as HTMLElement).click();
  await new Promise(resolve => setTimeout(resolve, RENDER_CONFIG.OVERLAY_DISMISS_WAIT));

  // Try to find and capture the canvas with retries
  const sourceCanvas = await waitForCanvas(kicanvasEmbed, mode);
  console.log(`[Capture] ${mode}: Final canvas state:`, !!sourceCanvas, sourceCanvas ? `${sourceCanvas.width}x${sourceCanvas.height}` : 'N/A');

  if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
    console.log('[Capture] Using native canvas export');

    // Check if source canvas is valid (not cyan error color)
    if (isInvalidCapture(sourceCanvas)) {
      console.error(`[Capture] ${mode}: Source canvas appears to be error state (cyan)`);
      throw new Error('Canvas shows error state (cyan color)');
    }

    // Create output canvas at target dimensions
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = THUMBNAIL_CONFIG.WIDTH;
    resizedCanvas.height = THUMBNAIL_CONFIG.HEIGHT;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw the source canvas scaled to target dimensions
    ctx.drawImage(
      sourceCanvas,
      0, 0, sourceCanvas.width, sourceCanvas.height,
      0, 0, THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT
    );

    return resizedCanvas.toDataURL('image/png', THUMBNAIL_CONFIG.QUALITY);
  }

  // Fallback to html2canvas
  console.log('[Capture] Falling back to html2canvas');
  const capturedCanvas = await html2canvas(containerElement, {
    backgroundColor: null,
    scale: THUMBNAIL_CONFIG.SCALE,
    logging: false,
    useCORS: true,
    allowTaint: true,
    foreignObjectRendering: false,
    width: containerElement.scrollWidth,
    height: containerElement.scrollHeight,
  });

  if (capturedCanvas.width === 0 || capturedCanvas.height === 0) {
    throw new Error('Captured canvas has zero dimensions');
  }

  // Check if html2canvas result is valid (not cyan error color)
  if (isInvalidCapture(capturedCanvas)) {
    console.error(`[Capture] ${mode}: html2canvas result appears to be error state (cyan)`);
    throw new Error('Canvas shows error state (cyan color)');
  }

  // Create output canvas at target dimensions
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = THUMBNAIL_CONFIG.WIDTH;
  resizedCanvas.height = THUMBNAIL_CONFIG.HEIGHT;

  const ctx = resizedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(
    capturedCanvas,
    0, 0, capturedCanvas.width, capturedCanvas.height,
    0, 0, THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT
  );

  return resizedCanvas.toDataURL('image/png', THUMBNAIL_CONFIG.QUALITY);
}

/**
 * Capture both light and dark KiCanvas viewers
 *
 * Uses two separate KiCanvas components with fixed themes
 * (kicad for light, witchhazel for dark) and captures both directly.
 */
export async function captureThumbnails(
  lightContainer: HTMLElement | null,
  darkContainer: HTMLElement | null
): Promise<ThumbnailResult> {
  let light: string | null = null;
  let dark: string | null = null;

  console.log('[Capture] Starting dual capture, light:', !!lightContainer, 'dark:', !!darkContainer);

  if (lightContainer) {
    try {
      light = await captureKiCanvasElement(lightContainer, 'light');
      console.log('[Capture] Light mode result:', light ? `${light.length} chars` : 'NULL');
    } catch (err) {
      console.error('[Capture] Light mode capture failed:', err);
    }
  }

  if (darkContainer) {
    try {
      dark = await captureKiCanvasElement(darkContainer, 'dark');
      console.log('[Capture] Dark mode result:', dark ? `${dark.length} chars` : 'NULL');
    } catch (err) {
      console.error('[Capture] Dark mode capture failed:', err);
    }
  }

  if (!light || !dark) {
    throw new Error(`Failed to capture thumbnails. Light: ${!!light}, Dark: ${!!dark}`);
  }

  console.log('[Capture] Dual capture complete!');
  return { light, dark };
}

/**
 * Convert base64 data URL to Blob for upload
 */
export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

/**
 * Upload thumbnail to R2 storage
 * @deprecated Use uploadThumbnailsToR2 for new uploads - this is kept for backwards compatibility
 */
export async function uploadThumbnail(
  supabase: any,
  userId: string,
  circuitId: string,
  theme: 'light' | 'dark',
  dataURL: string,
  version: number = 1
): Promise<string> {
  // Upload to R2 via API
  const response = await fetch('/api/upload-thumbnail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      circuitId,
      lightDataUrl: theme === 'light' ? dataURL : undefined,
      darkDataUrl: theme === 'dark' ? dataURL : undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to upload ${theme} thumbnail: ${data.error}`);
  }

  return theme === 'light' ? data.urls.light : data.urls.dark;
}

/**
 * Upload both thumbnails to R2 storage in a single request
 */
export async function uploadThumbnailsToR2(
  circuitId: string,
  lightDataUrl: string,
  darkDataUrl: string
): Promise<{ light: string; dark: string }> {
  const response = await fetch('/api/upload-thumbnail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      circuitId,
      lightDataUrl,
      darkDataUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to upload thumbnails: ${data.error}`);
  }

  return data.urls;
}