import { B612, B612_Mono } from "next/font/google";

// B612 was drawn for aircraft cockpit displays: plain, technical, very legible.
export const b612 = B612({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-b612",
});

// Mono is reserved for KiCad-native text, such as the Ctrl+C / Ctrl+V key shortcuts.
export const b612Mono = B612_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-b612-mono",
});
