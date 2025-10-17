import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* KiCanvas library for interactive schematic viewing - must be loaded as a module */}
        <script type="module" src="https://kicanvas.org/kicanvas/kicanvas.js" async />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
