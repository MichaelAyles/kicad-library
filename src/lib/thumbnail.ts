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
 * Capture a screenshot of the KiCanvas element in dark mode
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
 * Capture thumbnail in dark mode only and generate light mode programmatically
 *
 * Approach:
 * 1. Ensure we're in dark mode
 * 2. Wait fixed 2 seconds for KiCanvas to render
 * 3. Capture dark mode screenshot
 * 4. Generate light mode by inverting colors
 * 5. Return both thumbnails
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
      // Wait a bit for theme to apply
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait for KiCanvas to fully render
    console.log('Waiting for KiCanvas to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));

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
      upsert: false, // Don't overwrite - create new versions
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