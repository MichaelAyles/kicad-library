"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Heart, Download, ArrowLeft, Check } from "lucide-react";
import { addAttribution } from "@/lib/parser";

// Mock data - will be replaced with real database query
const mockCircuit = {
  id: "1",
  slug: "lm358-opamp-amplifier",
  title: "LM358 Non-Inverting Amplifier",
  description: "Dual op-amp based amplifier circuit with gain of 10. Input impedance ~1MΩ. Suitable for audio and sensor signal conditioning. Includes input/output capacitors for AC coupling.",
  user: {
    username: "johndoe",
    avatarUrl: null,
  },
  copyCount: 47,
  favoriteCount: 12,
  viewCount: 234,
  tags: ["opamp", "amplifier", "analog", "audio"],
  category: "Amplifier",
  license: "CERN-OHL-S-2.0",
  createdAt: new Date("2024-01-15"),
  sexprRaw: `(kicad_sch (version 20230121) (generator eeschema)
  (uuid "abc-123-def")
  (paper "A4")

  (lib_symbols
    (symbol "Device:R"
      (property "Reference" "R")
      (property "Value" "R")
      (pin "1" (uuid "pin1"))
      (pin "2" (uuid "pin2"))
    )
    (symbol "Amplifier_Operational:LM358"
      (property "Reference" "U")
      (property "Value" "LM358")
      (pin "1" (uuid "pin1"))
      (pin "2" (uuid "pin2"))
    )
  )

  (symbol (lib_id "Amplifier_Operational:LM358") (at 127 95.25 0)
    (uuid "comp1")
    (property "Reference" "U1" (at 129 93 0))
    (property "Value" "LM358" (at 129 97 0))
    (property "Footprint" "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm")
  )

  (symbol (lib_id "Device:R") (at 110 95.25 0)
    (uuid "comp2")
    (property "Reference" "R1" (at 112 93 0))
    (property "Value" "1k" (at 112 97 0))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric")
  )

  (symbol (lib_id "Device:R") (at 135 85.25 0)
    (uuid "comp3")
    (property "Reference" "R2" (at 137 83 0))
    (property "Value" "10k" (at 137 87 0))
    (property "Footprint" "Resistor_SMD:R_0805_2012Metric")
  )
)`,
  metadata: {
    components: [
      { reference: "U1", value: "LM358", footprint: "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm", lib_id: "Amplifier_Operational:LM358" },
      { reference: "R1", value: "1k", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:R" },
      { reference: "R2", value: "10k", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:R" },
    ],
    stats: {
      componentCount: 3,
      wireCount: 5,
      netCount: 4,
    },
    footprints: {
      assigned: 3,
      unassigned: 0,
    },
  },
};

export default function CircuitDetailPage() {
  const [copied, setCopied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const handleCopy = async () => {
    // Add attribution to S-expression
    const attributed = addAttribution(mockCircuit.sexprRaw, {
      title: mockCircuit.title,
      author: `@${mockCircuit.user.username}`,
      url: `https://circuitsnips.mikeayles.com/circuit/${mockCircuit.slug}`,
      license: mockCircuit.license,
    });

    try {
      await navigator.clipboard.writeText(attributed);
      setCopied(true);

      // TODO: Track copy event in database
      console.log("Copy event tracked");

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const handleFavorite = () => {
    // TODO: Implement favorite functionality
    setIsFavorited(!isFavorited);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            CircuitSnips
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/browse" className="text-sm font-medium hover:text-primary transition-colors">
              Browse
            </Link>
            <Link href="/search" className="text-sm font-medium hover:text-primary transition-colors">
              Search
            </Link>
            <Link href="/upload" className="text-sm font-medium hover:text-primary transition-colors">
              Upload
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/api/auth/signin"
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Back Button */}
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Browse
          </Link>

          {/* Title and Metadata */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{mockCircuit.title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>
                by{" "}
                <Link href={`/user/${mockCircuit.user.username}`} className="text-primary hover:underline">
                  @{mockCircuit.user.username}
                </Link>
              </span>
              <span>•</span>
              <span>Uploaded {mockCircuit.createdAt.toLocaleDateString()}</span>
              <span>•</span>
              <span>{mockCircuit.viewCount} views</span>
            </div>

            <p className="text-lg text-muted-foreground max-w-3xl">{mockCircuit.description}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={handleCopy}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy to Clipboard
                </>
              )}
            </button>

            <button
              onClick={handleFavorite}
              className={`px-6 py-3 border rounded-md font-medium transition-colors flex items-center gap-2 ${
                isFavorited ? "bg-red-50 border-red-200 text-red-600" : "hover:bg-muted/50"
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? "fill-current" : ""}`} />
              {isFavorited ? "Favorited" : "Favorite"} ({mockCircuit.favoriteCount})
            </button>

            <button className="px-6 py-3 border rounded-md font-medium hover:bg-muted/50 transition-colors flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download SVG
            </button>
          </div>

          {/* Viewer Placeholder */}
          <div className="bg-card border rounded-lg p-8 mb-8">
            <div className="aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Interactive Viewer Coming Soon</p>
              <p className="text-sm">KiCanvas WebGL viewer will be integrated here</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Components */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Components ({mockCircuit.metadata.stats.componentCount})</h2>
              <div className="space-y-3">
                {mockCircuit.metadata.components.map((comp, index) => (
                  <div key={index} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-mono font-medium">{comp.reference}</span>
                      <span className="text-muted-foreground ml-2">{comp.value}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{comp.footprint.split(":")[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats and Info */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Statistics</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Components:</span>
                  <span className="font-medium">{mockCircuit.metadata.stats.componentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wires:</span>
                  <span className="font-medium">{mockCircuit.metadata.stats.wireCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nets:</span>
                  <span className="font-medium">{mockCircuit.metadata.stats.netCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Footprints Assigned:</span>
                  <span className="font-medium">
                    {mockCircuit.metadata.footprints.assigned}/{mockCircuit.metadata.stats.componentCount}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-muted-foreground">Copies:</span>
                  <span className="font-medium">{mockCircuit.copyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Favorites:</span>
                  <span className="font-medium">{mockCircuit.favoriteCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {mockCircuit.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?tag=${tag}`}
                  className="px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* License */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">License</h2>
            <div className="flex items-center gap-4">
              <span className="px-4 py-2 bg-primary/10 text-primary rounded-md font-medium">
                {mockCircuit.license}
              </span>
              <p className="text-sm text-muted-foreground">
                This design is open source hardware. You can use, modify, and distribute it under the terms of this license.
              </p>
            </div>
          </div>

          {/* Attribution */}
          <div className="mt-8 bg-muted/30 border border-muted rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3">Attribution</h2>
            <p className="text-sm text-muted-foreground mb-3">
              When using this circuit, please include this attribution:
            </p>
            <div className="bg-card border rounded-md p-4 font-mono text-sm">
              <div>&quot;{mockCircuit.title}&quot;</div>
              <div>by @{mockCircuit.user.username}</div>
              <div>https://circuitsnips.mikeayles.com/circuit/{mockCircuit.slug}</div>
              <div>Licensed under {mockCircuit.license}</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-auto bg-muted/20">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>Built with ❤️ by the open source hardware community</p>
        </div>
      </footer>
    </div>
  );
}
