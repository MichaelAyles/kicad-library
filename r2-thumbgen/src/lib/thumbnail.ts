/**
 * Thumbnail Capture for R2 Thumbgen
 *
 * Captures screenshots of KiCanvas viewers using html2canvas
 */

import html2canvas from 'html2canvas';

// Configuration constants matching the main project
export const THUMBNAIL_CONFIG = {
  WIDTH: 800,
  HEIGHT: 566, // A4 Landscape aspect ratio: 800 / 1.414
  QUALITY: 0.9,
  SCALE: 2,
} as const;

export interface CapturedThumbnails {
  light: string | null;
  dark: string | null;
}

// Fixed crop percentages to exclude KiCanvas UI elements
const CROP_CONFIG = {
  TOP: 0.12,      // 12% from top
  RIGHT: 0.14,    // 14% from right
  BOTTOM: 0.12,   // 12% from bottom
  LEFT: 0.08,     // 8% from left
} as const;

/**
 * Capture a single KiCanvas viewer element with fixed crop to exclude UI
 */
export async function captureKiCanvasElement(
  containerElement: HTMLElement
): Promise<string> {
  // Find the kicanvas-embed element
  const kicanvasEmbed = containerElement.querySelector('kicanvas-embed');
  if (!kicanvasEmbed) {
    throw new Error('kicanvas-embed element not found in container');
  }

  // Try to click to dismiss any overlay
  (kicanvasEmbed as HTMLElement).click();
  await new Promise(resolve => setTimeout(resolve, 100));

  // Capture using html2canvas
  const sourceCanvas = await html2canvas(containerElement, {
    backgroundColor: null,
    scale: THUMBNAIL_CONFIG.SCALE,
    logging: false,
    useCORS: true,
    allowTaint: true,
    foreignObjectRendering: false,
    width: containerElement.scrollWidth,
    height: containerElement.scrollHeight,
  });

  if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    throw new Error('Captured canvas has zero dimensions');
  }

  // Apply fixed crop to remove UI elements
  const cropX = Math.floor(sourceCanvas.width * CROP_CONFIG.LEFT);
  const cropY = Math.floor(sourceCanvas.height * CROP_CONFIG.TOP);
  const cropWidth = Math.floor(sourceCanvas.width * (1 - CROP_CONFIG.LEFT - CROP_CONFIG.RIGHT));
  const cropHeight = Math.floor(sourceCanvas.height * (1 - CROP_CONFIG.TOP - CROP_CONFIG.BOTTOM));

  // Create output canvas at target dimensions
  const resizedCanvas = document.createElement('canvas');
  resizedCanvas.width = THUMBNAIL_CONFIG.WIDTH;
  resizedCanvas.height = THUMBNAIL_CONFIG.HEIGHT;

  const ctx = resizedCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(
    sourceCanvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT
  );

  return resizedCanvas.toDataURL('image/png', THUMBNAIL_CONFIG.QUALITY);
}

/**
 * Capture both light and dark KiCanvas viewers
 */
export async function captureBothThumbnails(
  lightContainer: HTMLElement | null,
  darkContainer: HTMLElement | null
): Promise<CapturedThumbnails> {
  const results: CapturedThumbnails = {
    light: null,
    dark: null,
  };

  if (lightContainer) {
    try {
      results.light = await captureKiCanvasElement(lightContainer);
      console.log('[Capture] Light mode captured successfully');
    } catch (err) {
      console.error('[Capture] Light mode capture failed:', err);
    }
  }

  if (darkContainer) {
    try {
      results.dark = await captureKiCanvasElement(darkContainer);
      console.log('[Capture] Dark mode captured successfully');
    } catch (err) {
      console.error('[Capture] Dark mode capture failed:', err);
    }
  }

  return results;
}

/**
 * Convert base64 data URL to Blob
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
