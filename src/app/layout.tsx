import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { b612, b612Mono } from "./fonts";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CookieNotice } from "@/components/CookieNotice";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CircuitSnips - Share KiCad Subcircuits",
  description:
    "Open-source platform for sharing and discovering reusable KiCad schematic subcircuits. Copy-paste circuits for your electronics projects.",
  keywords: [
    "KiCad",
    "electronics",
    "schematics",
    "open source hardware",
    "circuits",
    "PCB",
    "electronic design",
  ],
  authors: [{ name: "CircuitSnips", url: SITE_URL }],
  openGraph: {
    title: "CircuitSnips - Share KiCad Subcircuits",
    description:
      "Open-source platform for sharing reusable KiCad schematic subcircuits",
    url: SITE_URL,
    siteName: "CircuitSnips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CircuitSnips - Share KiCad Subcircuits",
    description:
      "Open-source platform for sharing reusable KiCad schematic subcircuits",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${b612.variable} ${b612Mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">{children}</div>
          <CookieNotice />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
