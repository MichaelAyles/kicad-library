import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'R2 Thumbnail Generator',
  description: 'Generate and migrate thumbnails to Cloudflare R2',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="/kicanvas/kicanvas.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
