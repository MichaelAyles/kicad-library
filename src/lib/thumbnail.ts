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
  MAX_WAIT_TIME: 5000, // Max time to wait for KiCanvas render (ms)
  POLL_INTERVAL: 100, // How often to check if KiCanvas is ready (ms)
  THEME_SWITCH_WAIT: 500, // Max time to wait for theme switch (ms)
  THEME_POLL_INTERVAL: 50, // How often to check theme (ms)
  OVERLAY_DISMISS_WAIT: 100, // Time to wait after dismissing overlay (ms)
  MIN_PIXEL_THRESHOLD: 10, // Minimum non-transparent pixels to consider rendered
} as const;

// For backwards compatibility
export const THUMBNAIL_WIDTH = THUMBNAIL_CONFIG.WIDTH;
export const THUMBNAIL_HEIGHT = THUMBNAIL_CONFIG.HEIGHT;

export interface ThumbnailResult {
  light: string; // base64 data URL
  dark: string;  // base64 data URL
}

/**
 * Check if a canvas has rendered content (not just blank/transparent)
 */
function hasRenderedContent(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      return false;
    }

    // Sample a few pixels from different areas to detect rendering
    const samplePoints = [
      [canvas.width / 4, canvas.height / 4],
      [canvas.width / 2, canvas.height / 2],
      [canvas.width * 3 / 4, canvas.height * 3 / 4],
    ];

    let nonTransparentPixels = 0;
    for (const [x, y] of samplePoints) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      // Check if pixel is not fully transparent
      if (pixel[3] > 0) {
        nonTransparentPixels++;
      }
    }

    return nonTransparentPixels >= RENDER_CONFIG.MIN_PIXEL_THRESHOLD / 3;
  } catch (error) {
    console.warn('Could not check canvas content:', error);
    return false;
  }
}

/**
 * Wait for KiCanvas to be ready and fully rendered
 * Polls the canvas element for actual rendered content
 */
async function waitForKiCanvasReady(element: HTMLElement): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < RENDER_CONFIG.MAX_WAIT_TIME) {
    try {
      // Find kicanvas-embed in regular DOM
      const kicanvasEmbed = element.querySelector('kicanvas-embed') as any;

      if (kicanvasEmbed && kicanvasEmbed.shadowRoot) {
        // Check if canvas exists in shadow DOM
        const canvas = kicanvasEmbed.shadowRoot.querySelector('canvas');

        if (canvas && canvas.width > 0 && canvas.height > 0) {
          // Check if canvas has actual rendered content
          if (hasRenderedContent(canvas)) {
            console.log(`KiCanvas ready after ${Date.now() - startTime}ms`);
            return;
          }
        }
      }
    } catch (error) {
      // Continue polling on errors (shadow DOM may not be accessible yet)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, RENDER_CONFIG.POLL_INTERVAL));
  }

  throw new Error(`KiCanvas failed to render within ${RENDER_CONFIG.MAX_WAIT_TIME}ms`);
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

    // Additionally, try to hide overlay by class name if it still exists
    const overlay = element.querySelector('.kc-overlay') as HTMLElement;
    const originalDisplay = overlay?.style.display;
    if (overlay) {
      overlay.style.display = 'none';
    }

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: THUMBNAIL_CONFIG.SCALE,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    // Restore overlay after capture
    if (overlay && originalDisplay !== undefined) {
      overlay.style.display = originalDisplay;
    }

    // Validate canvas dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error(`Canvas has invalid dimensions: ${canvas.width}x${canvas.height}. Element may not be visible or rendered.`);
    }

    // Resize canvas to thumbnail dimensions while maintaining aspect ratio
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = THUMBNAIL_CONFIG.WIDTH;
    resizedCanvas.height = THUMBNAIL_CONFIG.HEIGHT;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Calculate scaling to fit within thumbnail dimensions
    const scale = Math.min(
      THUMBNAIL_CONFIG.WIDTH / canvas.width,
      THUMBNAIL_CONFIG.HEIGHT / canvas.height
    );

    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;

    // Center the image
    const x = (THUMBNAIL_CONFIG.WIDTH - scaledWidth) / 2;
    const y = (THUMBNAIL_CONFIG.HEIGHT - scaledHeight) / 2;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, THUMBNAIL_CONFIG.WIDTH, THUMBNAIL_CONFIG.HEIGHT);

    // Draw scaled image
    ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);

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
 * Upload thumbnail to Supabase Storage with versioning
 */
export async function uploadThumbnail(
  supabase: any,
  userId: string,
  circuitId: string,
  theme: 'light' | 'dark',
  dataURL: string,
  version: number = 1
): Promise<string> {
  const blob = dataURLtoBlob(dataURL);
  // Store in user's folder with version: {userId}/{circuitId}-v{version}-{theme}.png
  const fileName = `${userId}/${circuitId}-v${version}-${theme}.png`;

  const { data, error } = await supabase.storage
    .from('thumbnails')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: true, // Allow overwrite when regenerating thumbnails
    });

  if (error) {
    throw new Error(`Failed to upload ${theme} thumbnail: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}