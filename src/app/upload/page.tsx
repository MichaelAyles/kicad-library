"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { validateKiCadSchematic, extractMetadata } from "@/lib/parser";

export default function UploadPage() {
  const [sexpr, setSexpr] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [license, setLicense] = useState("CERN-OHL-S-2.0");
  const [parseResult, setParseResult] = useState<{
    valid: boolean;
    error?: string;
    metadata?: ReturnType<typeof extractMetadata>;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleParse = () => {
    if (!sexpr.trim()) {
      setParseResult({ valid: false, error: "Please paste a schematic" });
      return;
    }

    setIsParsing(true);

    // Simulate async parsing (in real app, this might call an API)
    setTimeout(() => {
      const validation = validateKiCadSchematic(sexpr);

      if (!validation.valid) {
        setParseResult({ valid: false, error: validation.error });
        setIsParsing(false);
        return;
      }

      try {
        const metadata = extractMetadata(sexpr);
        setParseResult({ valid: true, metadata });

        // Auto-suggest title from first component if empty
        if (!title && metadata.components.length > 0) {
          const firstComp = metadata.components[0];
          setTitle(`${firstComp.value} Circuit`);
        }

        // Auto-suggest tags from components
        if (tags.length === 0 && metadata.uniqueComponents.length > 0) {
          const autoTags = metadata.uniqueComponents
            .slice(0, 3)
            .map(c => c.lib_id.split(':')[0].toLowerCase())
            .filter((t, i, arr) => arr.indexOf(t) === i); // unique
          setTags(autoTags);
        }
      } catch (error) {
        setParseResult({
          valid: false,
          error: error instanceof Error ? error.message : "Parse error"
        });
      }

      setIsParsing(false);
    }, 500);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && tags.length < 10) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parseResult?.valid) {
      alert("Please parse your schematic first");
      return;
    }

    // TODO: Submit to API
    console.log("Submitting:", { title, description, tags, license, sexpr });
    alert("Upload functionality coming soon! Data logged to console.");
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
            <Link href="/upload" className="text-sm font-medium text-primary">
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
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Upload Subcircuit</h1>
          <p className="text-muted-foreground mb-8">
            Share your KiCad schematic with the community
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Paste S-Expression */}
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </span>
                Paste Schematic Data
              </h2>

              <div className="mb-4">
                <textarea
                  value={sexpr}
                  onChange={(e) => setSexpr(e.target.value)}
                  placeholder="Paste KiCad schematic S-expression here...

Example: (kicad_sch (version 20230121) ...)"
                  className="w-full h-64 p-4 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing || !sexpr.trim()}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isParsing ? "Parsing..." : "Parse & Preview"}
                </button>

                <div className="text-sm text-muted-foreground">
                  💡 Tip: Select components in KiCad and press Ctrl+C
                </div>
              </div>

              {/* Parse Result */}
              {parseResult && (
                <div className={`mt-4 p-4 rounded-md ${parseResult.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  {parseResult.valid ? (
                    <div>
                      <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Valid KiCad {parseResult.metadata?.version ? `v${parseResult.metadata.version}` : ""} Format
                      </div>
                      {parseResult.metadata && (
                        <div className="text-sm text-green-600 space-y-1">
                          <p>✓ {parseResult.metadata.stats.componentCount} components found</p>
                          <p>✓ {parseResult.metadata.footprints.assigned}/{parseResult.metadata.stats.componentCount} footprints assigned</p>
                          <p>✓ {parseResult.metadata.stats.wireCount} wires, {parseResult.metadata.stats.netCount} nets</p>
                          {parseResult.metadata.warnings && parseResult.metadata.warnings.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-green-200">
                              <p className="font-medium">Warnings:</p>
                              {parseResult.metadata.warnings.map((w, i) => (
                                <p key={i}>⚠️ {w}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-5 h-5" />
                      {parseResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Add Details (only show if parsed successfully) */}
            {parseResult?.valid && (
              <div className="bg-card border rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </span>
                  Add Details
                </h2>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="LM358 Dual Op-Amp Circuit"
                      required
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this circuit does, its characteristics, and any important notes..."
                      rows={4}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(index)}
                            className="hover:text-primary/70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add a tag (press Enter)"
                        className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-4 py-2 border rounded-md hover:bg-muted/50"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum 10 tags
                    </p>
                  </div>

                  {/* License */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      License <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="CERN-OHL-S-2.0">CERN-OHL-S-2.0 (Recommended - Hardware, Share-Alike)</option>
                      <option value="MIT">MIT (Permissive)</option>
                      <option value="CC-BY-4.0">CC-BY-4.0 (Attribution)</option>
                      <option value="CC-BY-SA-4.0">CC-BY-SA-4.0 (Attribution, Share-Alike)</option>
                      <option value="GPL-3.0">GPL-3.0 (Copyleft)</option>
                      <option value="Apache-2.0">Apache-2.0 (Permissive with Patent Grant)</option>
                      <option value="BSD-2-Clause">BSD-2-Clause (Permissive)</option>
                      <option value="TAPR-OHL-1.0">TAPR-OHL-1.0 (Hardware-Specific)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose how others can use your circuit
                    </p>
                  </div>

                  {/* Agreement */}
                  <div className="bg-muted/30 p-4 rounded-md space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" required className="mt-1" />
                      <span className="text-sm">
                        I am the original creator OR have permission to share this design
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" required className="mt-1" />
                      <span className="text-sm">
                        This design does not infringe any intellectual property rights
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {parseResult?.valid && (
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel?")) {
                      setSexpr("");
                      setParseResult(null);
                      setTitle("");
                      setDescription("");
                      setTags([]);
                    }
                  }}
                  className="px-6 py-3 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Publish Subcircuit
                </button>
              </div>
            )}
          </form>
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
