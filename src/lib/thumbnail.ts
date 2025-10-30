/**
 * Thumbnail Generation for KiCanvas Viewer
 *
 * Captures screenshots of the KiCanvas viewer in both light and dark modes
 * Uses html2canvas for client-side screenshot generation
 */

import html2canvas from 'html2canvas';

// A4 Landscape aspect ratio: 297mm x 210mm ≈ 1.414:1
export const THUMBNAIL_WIDTH = 800;
export const THUMBNAIL_HEIGHT = 566; // 800 / 1.414

export interface ThumbnailResult {
  light: string; // base64 data URL
  dark: string;  // base64 data URL
}

/**
 * Wait for theme to apply and KiCanvas to re-render
 */
function waitForTheme(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Additionally, try to hide overlay by class name if it still exists
    const overlay = element.querySelector('.kc-overlay') as HTMLElement;
    const originalDisplay = overlay?.style.display;
    if (overlay) {
      overlay.style.display = 'none';
    }

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2, // Higher quality (2x resolution)
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
    resizedCanvas.width = THUMBNAIL_WIDTH;
    resizedCanvas.height = THUMBNAIL_HEIGHT;

    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Calculate scaling to fit within thumbnail dimensions
    const scale = Math.min(
      THUMBNAIL_WIDTH / canvas.width,
      THUMBNAIL_HEIGHT / canvas.height
    );

    const scaledWidth = canvas.width * scale;
    const scaledHeight = canvas.height * scale;

    // Center the image
    const x = (THUMBNAIL_WIDTH - scaledWidth) / 2;
    const y = (THUMBNAIL_HEIGHT - scaledHeight) / 2;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    // Draw scaled image
    ctx.drawImage(canvas, x, y, scaledWidth, scaledHeight);

    return resizedCanvas.toDataURL('image/png', 0.9);
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    throw new Error(`Failed to capture screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Capture thumbnails in both light and dark modes
 *
 * This function:
 * 1. Captures the current state (light mode)
 * 2. Switches to dark mode
 * 3. Waits for re-render
 * 4. Captures dark mode
 * 5. Switches back to original theme
 */
export async function captureThumbnails(
  kicanvasElement: HTMLElement,
  currentTheme: 'light' | 'dark',
  setTheme: (theme: 'light' | 'dark') => void
): Promise<ThumbnailResult> {
  try {
    let lightThumb: string;
    let darkThumb: string;

    if (currentTheme === 'light') {
      // Capture light mode first
      console.log('Capturing light mode thumbnail...');
      lightThumb = await captureElement(kicanvasElement);

      // Switch to dark mode
      console.log('Switching to dark mode...');
      setTheme('dark');
      await waitForTheme(400); // Wait for theme transition

      // Capture dark mode
      console.log('Capturing dark mode thumbnail...');
      darkThumb = await captureElement(kicanvasElement);

      // Switch back to light
      console.log('Switching back to light mode...');
      setTheme('light');
      await waitForTheme(300);
    } else {
      // Currently in dark mode
      // Capture dark mode first
      console.log('Capturing dark mode thumbnail...');
      darkThumb = await captureElement(kicanvasElement);

      // Switch to light mode
      console.log('Switching to light mode...');
      setTheme('light');
      await waitForTheme(400);

      // Capture light mode
      console.log('Capturing light mode thumbnail...');
      lightThumb = await captureElement(kicanvasElement);

      // Switch back to dark
      console.log('Switching back to dark mode...');
      setTheme('dark');
      await waitForTheme(300);
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
 * Upload thumbnail to Supabase Storage
 */
export async function uploadThumbnail(
  supabase: any,
  userId: string,
  circuitId: string,
  theme: 'light' | 'dark',
  dataURL: string
): Promise<string> {
  const blob = dataURLtoBlob(dataURL);
  // Store in user's folder: {userId}/{circuitId}-{theme}.png
  const fileName = `${userId}/${circuitId}-${theme}.png`;

  const { data, error } = await supabase.storage
    .from('thumbnails')
    .upload(fileName, blob, {
      contentType: 'image/png',
      upsert: true, // Overwrite if exists
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