import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CircuitSnips - Share KiCad Subcircuits",
  description: "Open-source platform for sharing and discovering reusable KiCad schematic subcircuits",
  keywords: ["KiCad", "electronics", "schematics", "open source hardware", "circuits"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* KiCanvas library for interactive schematic viewing */}
        <Script
          src="https://kicanvas.org/kicanvas/kicanvas.js"
          strategy="beforeInteractive"
        />
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
