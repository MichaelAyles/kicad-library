"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, Heart, Download, ArrowLeft, Check, FileDown, Loader } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { addAttribution, isClipboardSnippet, wrapSnippetToFullFile, extractSnippetFromFullFile, validateSExpression } from "@/lib/kicad-parser";
import { SchematicViewer } from "@/components/SchematicViewer";
import { formatDate } from "@/lib/utils";
import { getCircuitBySlug, incrementViewCount, type Circuit } from "@/lib/circuits";

export default function CircuitDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [snippetData, setSnippetData] = useState<string>(""); // For copy button - always snippet
  const [fullFileData, setFullFileData] = useState<string>(""); // For preview/download - always full file
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null); // Parsed metadata from S-expression

  // Load circuit data from database
  useEffect(() => {
    if (!slug) return;

    const loadCircuit = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch circuit from database
        const circuitData = await getCircuitBySlug(slug);

        if (!circuitData) {
          setError("Circuit not found");
          setIsLoading(false);
          return;
        }

        setCircuit(circuitData);

        // Increment view count (fire and forget)
        incrementViewCount(circuitData.id).catch(err =>
          console.error("Failed to increment view count:", err)
        );

        // Prepare circuit data for copy and preview
        prepareCircuitData(circuitData.raw_sexpr, circuitData.title);

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load circuit:", err);
        setError(err instanceof Error ? err.message : "Failed to load circuit");
        setIsLoading(false);
      }
    };

    loadCircuit();
  }, [slug]);

  // Helper function to prepare data from database
  const prepareCircuitData = (rawSexpr: string, title: string) => {
    // Validate and parse the S-expression to extract metadata
    const validation = validateSExpression(rawSexpr);

    if (validation.valid && validation.metadata) {
      setMetadata(validation.metadata);
    }

    if (isClipboardSnippet(rawSexpr)) {
      // It's a snippet - use as-is for copy, wrap for preview/download
      setSnippetData(rawSexpr);
      setFullFileData(wrapSnippetToFullFile(rawSexpr, { title }));
    } else {
      // It's a full file - extract snippet for copy, use as-is for preview/download
      setSnippetData(extractSnippetFromFullFile(rawSexpr));
      setFullFileData(rawSexpr);
    }
  };

  const handleCopy = async () => {
    if (!snippetData) {
      alert("Circuit data is still loading");
      return;
    }

    // Copy snippet data only (no kicad_sch wrapper)
    // Users can paste this directly into KiCad
    try {
      await navigator.clipboard.writeText(snippetData);
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
    if (!fullFileData || !circuit) {
      alert("Schematic file is still loading");
      return;
    }

    // Add attribution to the complete schematic file
    const attributed = addAttribution(fullFileData, {
      author: circuit.user?.username ? `@${circuit.user.username}` : 'Unknown',
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg text-muted-foreground">Loading circuit...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show error state
  if (error || !circuit) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Browse
            </Link>
            <div className="bg-card border rounded-lg p-12 text-center">
              <h1 className="text-2xl font-bold mb-2">Circuit Not Found</h1>
              <p className="text-muted-foreground mb-6">
                {error || "The circuit you're looking for doesn't exist or has been removed."}
              </p>
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                Browse Circuits
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

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
              {circuit.user && (
                <>
                  <span>
                    by{" "}
                    <Link href={`/user/${circuit.user.username}`} className="text-primary hover:underline">
                      @{circuit.user.username}
                    </Link>
                  </span>
                  <span>•</span>
                </>
              )}
              <span>Uploaded {formatDate(circuit.created_at)}</span>
              <span>•</span>
              <span>{circuit.view_count} views</span>
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
              {isFavorited ? "Favorited" : "Favorite"} ({circuit.favorite_count})
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
          ) : fullFileData ? (
            <div className="mb-8">
              <SchematicViewer sexpr={fullFileData} title={circuit.title} slug={circuit.slug} />
            </div>
          ) : (
            <div className="bg-card border rounded-lg p-8 mb-8">
              <div className="aspect-video bg-muted rounded-md flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">Failed to load circuit</p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          {metadata && (
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Components */}
              <div className="bg-card border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Components ({metadata.stats.componentCount})</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {metadata.components.map((comp: any, index: number) => (
                    <div key={index} className="flex items-start justify-between text-sm">
                      <div>
                        <span className="font-mono font-medium">{comp.reference}</span>
                        <span className="text-muted-foreground ml-2">{comp.value}</span>
                      </div>
                      {comp.footprint && (
                        <span className="text-xs text-muted-foreground">{comp.footprint.split(":")[1] || comp.footprint}</span>
                      )}
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
                    <span className="font-medium">{metadata.stats.componentCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wires:</span>
                    <span className="font-medium">{metadata.stats.wireCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nets:</span>
                    <span className="font-medium">{metadata.stats.netCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Footprints Assigned:</span>
                    <span className="font-medium">
                      {metadata.footprints.assigned}/{metadata.stats.componentCount}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-muted-foreground">Copies:</span>
                    <span className="font-medium">{circuit.copy_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Favorites:</span>
                    <span className="font-medium">{circuit.favorite_count}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              {circuit.user && <div>by @{circuit.user.username}</div>}
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

      <Footer />
    </div>
  );
}
