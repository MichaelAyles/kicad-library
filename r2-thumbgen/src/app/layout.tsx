import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
