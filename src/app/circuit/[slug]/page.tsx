"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Copy, Heart, Download, ArrowLeft, Check, FileDown } from "lucide-react";
import { addAttribution } from "@/lib/parser";
import { knockSensorCircuit, loadKnockSensorClipboardData, loadKnockSensorSchematicFile } from "@/lib/knock-sensor-data";
import { SchematicViewer } from "@/components/SchematicViewer";

export default function CircuitDetailPage() {
  const [copied, setCopied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [clipboardData, setClipboardData] = useState<string>("");
  const [schematicFile, setSchematicFile] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const circuit = knockSensorCircuit;

  // Load both clipboard data (for copy) and complete file (for viewer/download)
  useEffect(() => {
    Promise.all([
      loadKnockSensorClipboardData(),
      loadKnockSensorSchematicFile()
    ])
      .then(([clipboard, schematic]) => {
        setClipboardData(clipboard);
        setSchematicFile(schematic);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load circuit data:", err);
        setIsLoading(false);
      });
  }, []);

  const handleCopy = async () => {
    if (!clipboardData) {
      alert("Circuit data is still loading");
      return;
    }

    // Copy raw clipboard data without modification
    // (Users can paste this directly into KiCad - attribution would break the format)
    try {
      await navigator.clipboard.writeText(clipboardData);
      setCopied(true);

      // TODO: Track copy event in database
      console.log("Copy event tracked");

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    if (!schematicFile) {
      alert("Schematic file is still loading");
      return;
    }

    // Add attribution to the complete schematic file
    const attributed = addAttribution(schematicFile, {
      title: circuit.title,
      author: `@${circuit.user.username}`,
      url: `https://circuitsnips.mikeayles.com/circuit/${circuit.slug}`,
      license: circuit.license,
    });

    // Create a blob and download link
    const blob = new Blob([attributed], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${circuit.slug}.kicad_sch`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // TODO: Track download event in database
    console.log("Download event tracked");
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
            <h1 className="text-4xl font-bold mb-4">{circuit.title}</h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span>
                by{" "}
                <Link href={`/user/${circuit.user.username}`} className="text-primary hover:underline">
                  @{circuit.user.username}
                </Link>
              </span>
              <span>•</span>
              <span>Uploaded {circuit.createdAt.toLocaleDateString()}</span>
              <span>•</span>
              <span>{circuit.viewCount} views</span>
            </div>

            <p className="text-lg text-muted-foreground max-w-3xl">{circuit.description}</p>
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
              {isFavorited ? "Favorited" : "Favorite"} ({circuit.favoriteCount})
            </button>

            <button
              onClick={handleDownload}
              className="px-6 py-3 border rounded-md font-medium hover:bg-muted/50 transition-colors flex items-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              Download .kicad_sch
            </button>
          </div>

          {/* Schematic Viewer */}
          {isLoading ? (
            <div className="bg-card border rounded-lg p-8 mb-8">
              <div className="aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Loading circuit...</p>
              </div>
            </div>
          ) : schematicFile ? (
            <div className="mb-8">
              <SchematicViewer sexpr={schematicFile} title={circuit.title} slug={circuit.slug} />
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-8 mb-8">
              <div className="aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Failed to load circuit</p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Components */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Components ({circuit.metadata.stats.componentCount})</h2>
              <div className="space-y-3">
                {circuit.metadata.components.map((comp, index) => (
                  <div key={index} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-mono font-medium">{comp.reference}</span>
                      <span className="text-muted-foreground ml-2">{comp.value}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{comp.footprint.split(":")[1] || comp.footprint}</span>
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
                  <span className="font-medium">{circuit.metadata.stats.componentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wires:</span>
                  <span className="font-medium">{circuit.metadata.stats.wireCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nets:</span>
                  <span className="font-medium">{circuit.metadata.stats.netCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Footprints Assigned:</span>
                  <span className="font-medium">
                    {circuit.metadata.footprints.assigned}/{circuit.metadata.stats.componentCount}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-muted-foreground">Copies:</span>
                  <span className="font-medium">{circuit.copyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Favorites:</span>
                  <span className="font-medium">{circuit.favoriteCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {circuit.tags.map((tag) => (
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
                {circuit.license}
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
              When using this circuit, please include this attribution in your documentation:
            </p>
            <div className="bg-card border rounded-md p-4 font-mono text-sm">
              <div>&quot;{circuit.title}&quot;</div>
              <div>by @{circuit.user.username}</div>
              <div>https://circuitsnips.mikeayles.com/circuit/{circuit.slug}</div>
              <div>Licensed under {circuit.license}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Note: The &quot;Copy to Clipboard&quot; button copies raw data for easy pasting.
              The downloaded .kicad_sch file includes attribution in the schematic metadata.
            </p>
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
