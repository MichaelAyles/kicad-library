import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'R2 Thumbnail Generator',
  description: 'Generate and migrate thumbnails to Cloudflare R2',
};

// Suppress KiCanvas setTransform errors in development
const suppressKiCanvasErrors = `
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('setTransform')) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  }, true);
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Suppress KiCanvas timing errors */}
        <script dangerouslySetInnerHTML={{ __html: suppressKiCanvasErrors }} />
        {/* KiCanvas library - must be loaded as module like in main project */}
        <script type="module" src="/kicanvas/kicanvas.js" async />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
