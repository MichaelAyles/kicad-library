import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CookieNotice } from "@/components/CookieNotice";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CircuitSnips - Share KiCad Subcircuits",
  description: "Open-source platform for sharing and discovering reusable KiCad schematic subcircuits. Copy-paste circuits for your electronics projects.",
  keywords: ["KiCad", "electronics", "schematics", "open source hardware", "circuits", "PCB", "electronic design"],
  authors: [{ name: "CircuitSnips", url: "https://circuitsnips.mikeayles.com" }],
  openGraph: {
    title: "CircuitSnips - Share KiCad Subcircuits",
    description: "Open-source platform for sharing reusable KiCad schematic subcircuits",
    url: "https://circuitsnips.mikeayles.com",
    siteName: "CircuitSnips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CircuitSnips - Share KiCad Subcircuits",
    description: "Open-source platform for sharing reusable KiCad schematic subcircuits",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* KiCanvas library for interactive schematic viewing - self-hosted from michaelayles/kicanvas fork */}
        <script type="module" src="https://kicanvas.mikeayles.com/kicanvas.js" async />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
          <CookieNotice />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
