/**
 * Thumbnail Generation for KiCanvas Viewer
 *
 * Captures screenshots of the KiCanvas viewer in both light and dark modes
 * Uses html2canvas for client-side screenshot generation
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
  THEME_SWITCH_WAIT: 1000, // Max time to wait for theme switch (ms)
  THEME_POLL_INTERVAL: 50, // How often to check theme (ms)
  OVERLAY_DISMISS_WAIT: 100, // Time to wait after dismissing overlay (ms)
} as const;

// For backwards compatibility
export const THUMBNAIL_WIDTH = THUMBNAIL_CONFIG.WIDTH;
export const THUMBNAIL_HEIGHT = THUMBNAIL_CONFIG.HEIGHT;

export interface ThumbnailResult {
  light: string; // base64 data URL
  dark: string;  // base64 data URL
}

/**
 * Wait for KiCanvas to be ready and fully rendered
 * Listens for the 'kicanvas:render' event which fires after the first frame is drawn
 */
async function waitForKiCanvasReady(element: HTMLElement): Promise<void> {
  console.log('Waiting for KiCanvas to render...');

  // Find the kicanvas-embed element
  const kicanvasEmbed = element.querySelector('kicanvas-embed');
  if (!kicanvasEmbed) {
    throw new Error('kicanvas-embed element not found');
  }

  // Check if already rendered (in case the event already fired)
  if (kicanvasEmbed.hasAttribute('rendered')) {
    console.log('KiCanvas already rendered');
    return;
  }

  // Wait for the kicanvas:render event with timeout
  const renderPromise = new Promise<void>((resolve) => {
    kicanvasEmbed.addEventListener('kicanvas:render', () => {
      console.log('KiCanvas render event received');
      resolve();
    }, { once: true });
  });

  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`KiCanvas render timeout after ${RENDER_CONFIG.RENDER_TIMEOUT}ms`));
    }, RENDER_CONFIG.RENDER_TIMEOUT);
  });

  await Promise.race([renderPromise, timeoutPromise]);
  console.log('KiCanvas render complete');
}

/**
 * Wait for theme to be applied to the document
 */
async function waitForThemeApplied(expectedTheme: 'light' | 'dark'): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < RENDER_CONFIG.THEME_SWITCH_WAIT) {
    const currentTheme = document.documentElement.getAttribute('data-theme') ||
      document.documentElement.className.includes('dark') ? 'dark' : 'light';

    if (currentTheme === expectedTheme) {
      console.log(`Theme switched to ${expectedTheme} after ${Date.now() - startTime}ms`);
      return;
    }

    await new Promise(resolve => setTimeout(resolve, RENDER_CONFIG.THEME_POLL_INTERVAL));
  }

  // Log warning but don't fail - theme might be applied differently
  console.warn(`Theme did not switch to ${expectedTheme} within ${RENDER_CONFIG.THEME_SWITCH_WAIT}ms`);
}

/**
 * Generate light mode thumbnail from dark mode by inverting colors
 * Creates a lighter, inverted version suitable for light themes
 */
function generateLightFromDark(darkDataURL: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw the dark image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Invert colors (skip alpha channel)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
        // data[i + 3] is alpha, keep unchanged
      }

      // Put the inverted data back
      ctx.putImageData(imageData, 0, 0);

      // Convert to data URL
      resolve(canvas.toDataURL('image/png', 0.9));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for light mode generation'));
    };

    img.src = darkDataURL;
  });
}

/**
 * Capture a screenshot of the KiCanvas element
 * Uses html2canvas with WebGL preservation
 */
async function captureElement(element: HTMLElement): Promise<string> {
  try {
    // Find the kicanvas-embed element and trigger interaction to remove overlay
    const kicanvasEmbed = element.querySelector('kicanvas-embed') as any;
    if (kicanvasEmbed) {
      // Simulate a click to activate the viewer and dismiss overlay
      kicanvasEmbed.click();
      // Wait a bit for the overlay to disappear
      await new Promise(resolve => setTimeout(resolve, RENDER_CONFIG.OVERLAY_DISMISS_WAIT));
    }

    // Hide overlay if it exists
    const overlay = element.querySelector('.kc-overlay') as HTMLElement;
    const originalDisplay = overlay?.style.display;
    if (overlay) {
      overlay.style.display = 'none';
    }

    // Use html2canvas but make sure we're capturing the right element
    // KiCanvas renders in shadow DOM, which html2canvas can't capture
    // So we need to use a different approach - capture using browser's native API
    const sourceCanvas = await html2canvas(element, {
      backgroundColor: null,
      scale: THUMBNAIL_CONFIG.SCALE,
      logging: true,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false, // Disable to avoid issues with shadow DOM
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    // Restore overlay
    if (overlay && originalDisplay !== undefined) {
      overlay.style.display = originalDisplay;
    }

    console.log(`Captured canvas: ${sourceCanvas.width}x${sourceCanvas.height}`);

    // Validate canvas dimensions
    if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
      throw new Error(`Canvas has invalid dimensions: ${sourceCanvas.width}x${sourceCanvas.height}. Element may not be visible or rendered.`);
    }

    // Instead of resizing to fixed dimensions with letterboxing,
    // we'll crop the canvas to fit the target aspect ratio and then scale
    const targetAspectRatio = THUMBNAIL_CONFIG.WIDTH / THUMBNAIL_CONFIG.HEIGHT;
    const sourceAspectRatio = sourceCanvas.width / sourceCanvas.height;

    let cropWidth = sourceCanvas.width;
    let cropHeight = sourceCanvas.height;
    let cropX = 0;
    let cropY = 0;

    // Crop to match target aspect ratio
    if (sourceAspectRatio > targetAspectRatio) {
      // Source is wider - crop width
      cropWidth = sourceCanvas.height * targetAspectRatio;
      cropX = (sourceCanvas.width - cropWidth) / 2;
    } else if (sourceAspectRatio < targetAspectRatio) {
      // Source is taller - crop height
      cropHeight = sourceCanvas.width / targetAspectRatio;
      cropY = (sourceCanvas.height - cropHeight) / 2;
    }

    // Create output canvas at target dimensions
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = THUMBNAIL_CONFIG.WIDTH;
    resizedCanvas.height = THUMBNAIL_CONFIG.HEIGHT;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw the cropped and scaled image directly from the source canvas
    ctx.drawImage(
      sourceCanvas,
      cropX, cropY, cropWidth, cropHeight,  // Source rectangle (cropped)
      0, 0, THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT  // Destination rectangle (full canvas)
    );

    console.log(`Captured and resized to ${THUMBNAIL_CONFIG.WIDTH}x${THUMBNAIL_CONFIG.HEIGHT}`);

    return resizedCanvas.toDataURL('image/png', THUMBNAIL_CONFIG.QUALITY);
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    throw new Error(`Failed to capture screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Capture thumbnail in dark mode only and generate light mode programmatically
 *
 * Approach:
 * 1. Ensure we're in dark mode
 * 2. Wait for theme to apply (smart polling)
 * 3. Wait for KiCanvas to fully render (smart polling with pixel validation)
 * 4. Capture dark mode screenshot
 * 5. Generate light mode by inverting colors
 * 6. Return both thumbnails
 *
 * This is ~2x faster than capturing both modes separately.
 */
export async function captureThumbnails(
  kicanvasElement: HTMLElement,
  currentTheme: 'light' | 'dark',
  setTheme: (theme: 'light' | 'dark') => void
): Promise<ThumbnailResult> {
  try {
    // Switch to dark mode if not already
    if (currentTheme !== 'dark') {
      console.log('Switching to dark mode...');
      setTheme('dark');
      // Wait for theme to actually apply
      await waitForThemeApplied('dark');
    }

    // Wait for KiCanvas to fully render with smart polling
    console.log('Waiting for KiCanvas to load...');
    await waitForKiCanvasReady(kicanvasElement);

    console.log('Capturing dark mode thumbnail...');

    // Capture dark mode screenshot
    const darkThumb = await captureElement(kicanvasElement);

    console.log('Generating light mode thumbnail from dark mode...');

    // Generate light mode by inverting colors
    const lightThumb = await generateLightFromDark(darkThumb);

    // Switch back to original theme if needed
    if (currentTheme === 'light') {
      console.log('Switching back to light mode...');
      setTheme('light');
      await waitForThemeApplied('light');
    }

    console.log('Thumbnail capture complete!');
    return { light: lightThumb, dark: darkThumb };
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    throw err;
  }
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