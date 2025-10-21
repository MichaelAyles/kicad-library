"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle, CheckCircle2, Eye, Loader, Camera } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import {
  validateSExpression,
  generateSlug,
  suggestTags,
  suggestCategory,
  wrapSnippetToFullFile,
  type ParsedMetadata,
  type ValidationResult,
} from "@/lib/kicad-parser";
import { captureThumbnails, uploadThumbnail } from "@/lib/thumbnail";
import { createClient } from "@/lib/supabase/client";

// Declare the kicanvas-embed custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'kicanvas-embed': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        controls?: 'none' | 'basic' | 'full';
        theme?: 'kicad' | 'witchhazel';
      }, HTMLElement>;
    }
  }
}

type UploadStep = 'paste' | 'preview' | 'metadata' | 'thumbnails' | 'uploading' | 'success';

export default function UploadPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load KiCanvas library for preview
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.querySelector('script[src*="kicanvas"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/kicanvas@0.7.4/dist/kicanvas.min.js';
      script.type = 'module';
      document.head.appendChild(script);
    }
  }, []);

  // Form state
  const [currentStep, setCurrentStep] = useState<UploadStep>('paste');
  const [sexpr, setSexpr] = useState(""); // Original input (snippet or full file)
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [fullFileSexpr, setFullFileSexpr] = useState<string>(""); // Always full file format for preview/storage

  // Metadata form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [license, setLicense] = useState("CERN-OHL-S-2.0");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Thumbnails
  const [lightThumbnail, setLightThumbnail] = useState<string>("");
  const [darkThumbnail, setDarkThumbnail] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);

  // Preview
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Loading states
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);

  // Generate URL from title
  useEffect(() => {
    if (title) {
      setSlug(generateSlug(title));
    }
  }, [title]);

  // Create preview URL when fullFileSexpr changes
  useEffect(() => {
    async function createPreview() {
      if (!fullFileSexpr) {
        setPreviewUrl("");
        return;
      }

      setIsLoadingPreview(true);
      try {
        // Send schematic to preview API
        const response = await fetch('/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sexpr: fullFileSexpr }),
        });

        if (!response.ok) {
          throw new Error('Failed to create preview');
        }

        const { previewId } = await response.json();
        // CRITICAL: KiCanvas needs .kicad_sch extension in the URL path to detect file type
        // We use the filename in the path, and pass the ID as a query parameter
        setPreviewUrl(`/api/preview/preview.kicad_sch?id=${previewId}`);
      } catch (error) {
        console.error('Preview creation failed:', error);
        setPreviewUrl("");
      } finally {
        setIsLoadingPreview(false);
      }
    }

    createPreview();
  }, [fullFileSexpr]);

  // Step 1: Parse and validate
  const handleParse = () => {
    if (!sexpr.trim()) {
      setValidation({ valid: false, errors: ["Please paste a schematic"], warnings: [], isSnippet: false, originalFormat: 'full' });
      return;
    }

    setIsParsing(true);

    setTimeout(() => {
      const result = validateSExpression(sexpr);
      setValidation(result);

      if (result.valid && result.metadata) {
        setMetadata(result.metadata);

        // If it's a snippet, wrap it. Otherwise use as-is
        if (result.isSnippet) {
          const wrapped = wrapSnippetToFullFile(sexpr, { title: title || 'Circuit' });
          setFullFileSexpr(wrapped);
        } else {
          setFullFileSexpr(sexpr);
        }

        // Auto-suggest metadata
        if (!title) {
          const firstComp = result.metadata.components[0];
          if (firstComp) {
            setTitle(`${firstComp.value} ${firstComp.lib_id.split(':')[1] || 'Circuit'}`);
          }
        }

        if (tags.length === 0) {
          setTags(suggestTags(result.metadata));
        }

        if (category === "General") {
          setCategory(suggestCategory(result.metadata));
        }

        setCurrentStep('preview');
      }

      setIsParsing(false);
    }, 300);
  };

  // Step 2: Continue to metadata form
  const handleContinueToMetadata = () => {
    setCurrentStep('metadata');
  };

  // Step 3: Continue to thumbnail capture
  const handleContinueToThumbnails = () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }
    setCurrentStep('thumbnails');
  };

  // Step 4: Capture thumbnails
  const handleCaptureThumbnails = async () => {
    if (!viewerRef.current) {
      alert("Viewer not ready");
      return;
    }

    const kicanvasElement = viewerRef.current.querySelector('kicanvas-embed') as HTMLElement;
    if (!kicanvasElement) {
      alert("KiCanvas viewer not found");
      return;
    }

    setIsCapturing(true);

    try {
      const currentTheme = theme === 'dark' ? 'dark' : 'light';
      const thumbnails = await captureThumbnails(
        kicanvasElement,
        currentTheme,
        (newTheme) => setTheme(newTheme)
      );

      setLightThumbnail(thumbnails.light);
      setDarkThumbnail(thumbnails.dark);

      // Immediately proceed to upload
      handleUpload(thumbnails.light, thumbnails.dark);
    } catch (err) {
      console.error("Thumbnail capture failed:", err);
      alert("Failed to capture thumbnails. Please try again.");
      setIsCapturing(false);
    }
  };

  // Helper function to ensure slug is unique
  const ensureUniqueSlug = async (baseSlug: string): Promise<string> => {
    let uniqueSlug = baseSlug;
    let counter = 2;

    while (true) {
      // Check if slug exists
      const { data, error } = await supabase
        .from('circuits')
        .select('id')
        .eq('slug', uniqueSlug)
        .maybeSingle();

      if (error) {
        console.error('Error checking slug:', error);
        throw error;
      }

      // If no circuit found with this slug, it's unique!
      if (!data) {
        return uniqueSlug;
      }

      // Slug exists, try with a number suffix
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  };

  // Step 5: Upload everything
  const handleUpload = async (lightThumb: string, darkThumb: string) => {
    if (!user) {
      alert("You must be logged in");
      return;
    }

    setCurrentStep('uploading');
    setIsUploading(true);

    try {
      // 1. Ensure slug is unique
      setUploadProgress("Checking slug availability...");
      const uniqueSlug = await ensureUniqueSlug(slug);

      if (uniqueSlug !== slug) {
        console.log(`Slug "${slug}" was taken, using "${uniqueSlug}" instead`);
      }

      // 2. Create circuit record
      setUploadProgress("Creating circuit record...");

      const circuitData = {
        user_id: user.id,
        slug: uniqueSlug,
        title,
        description,
        category,
        tags,
        license,
        raw_sexpr: sexpr, // Store original format (snippet or full file as entered)
        is_public: isPublic,
        // view_count, copy_count, favorite_count default to 0 in schema
      };

      const { data: circuit, error: circuitError } = await supabase
        .from('circuits')
        .insert([circuitData])
        .select()
        .single();

      if (circuitError) throw circuitError;

      // 2. Upload thumbnails to storage
      setUploadProgress("Uploading light theme thumbnail...");
      const lightUrl = await uploadThumbnail(supabase, circuit.id, 'light', lightThumb);

      setUploadProgress("Uploading dark theme thumbnail...");
      const darkUrl = await uploadThumbnail(supabase, circuit.id, 'dark', darkThumb);

      // 3. Update circuit with thumbnail URLs
      setUploadProgress("Finalizing...");
      const { error: updateError } = await supabase
        .from('circuits')
        .update({
          thumbnail_light_url: lightUrl,
          thumbnail_dark_url: darkUrl,
        })
        .eq('id', circuit.id);

      if (updateError) throw updateError;

      // Success!
      setCurrentStep('success');
      setIsUploading(false);

      // Redirect to circuit page after 2 seconds
      setTimeout(() => {
        router.push(`/circuit/${uniqueSlug}`);
      }, 2000);

    } catch (err) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsUploading(false);
      setCurrentStep('thumbnails');
    }
  };

  // Tag management
  const handleAddTag = () => {
    if (tagInput.trim() && tags.length < 10 && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  if (authLoading || !user) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Upload Circuit</h1>
          <p className="text-muted-foreground mb-8">
            Share your KiCad schematic with the community
          </p>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8">
            {[
              { key: 'paste', label: 'Paste' },
              { key: 'preview', label: 'Preview' },
              { key: 'metadata', label: 'Details' },
              { key: 'thumbnails', label: 'Thumbnails' },
            ].map((step, index) => (
              <div key={step.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    currentStep === step.key ||
                    (currentStep === 'uploading' && index < 4) ||
                    (currentStep === 'success' && index < 4)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-sm hidden md:inline">{step.label}</span>
                {index < 3 && <div className="w-8 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>

          {/* Step 1: Paste */}
          {currentStep === 'paste' && (
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Paste Your Schematic</h2>
              <p className="text-muted-foreground mb-4">
                Copy your circuit from KiCad (Ctrl+C) and paste it here, or upload a .kicad_sch file.
              </p>

              <textarea
                value={sexpr}
                onChange={(e) => setSexpr(e.target.value)}
                placeholder="(kicad_sch (version 20230121) (generator eeschema) ...)"
                className="w-full h-64 p-4 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y bg-background"
              />

              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={handleParse}
                  disabled={isParsing || !sexpr.trim()}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isParsing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Validate & Preview
                    </>
                  )}
                </button>
              </div>

              {/* Validation result */}
              {validation && (
                <div
                  className={`mt-4 p-4 rounded-md border ${
                    validation.valid
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                  }`}
                >
                  {validation.valid ? (
                    <div>
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Valid KiCad Schematic (v{metadata?.version})
                      </div>
                      {metadata && (
                        <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                          <p>✓ {metadata.stats.componentCount} components</p>
                          <p>✓ {metadata.footprints.assigned}/{metadata.footprints.assigned + metadata.footprints.unassigned} footprints assigned</p>
                          <p>✓ {metadata.stats.wireCount} wires, {metadata.stats.netCount} nets</p>
                        </div>
                      )}
                      {validation.warnings.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                          {validation.warnings.map((w, i) => (
                            <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400">
                              ⚠️ {w}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium mb-2">
                        <AlertCircle className="w-5 h-5" />
                        Validation Failed
                      </div>
                      {validation.errors.map((err, i) => (
                        <p key={i} className="text-sm text-red-600 dark:text-red-400">
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview & Circuit Summary */}
          {currentStep === 'preview' && metadata && (
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Preview & Circuit Summary</h2>
              <p className="text-muted-foreground mb-6">
                Review your circuit schematic and details before adding metadata.
              </p>

              {/* KiCanvas Preview */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Interactive Preview:</h3>
                <div className="bg-background rounded-md overflow-hidden border" style={{ height: '450px' }} ref={viewerRef}>
                  {isLoadingPreview ? (
                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                      <div className="text-center">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading preview...</p>
                      </div>
                    </div>
                  ) : previewUrl ? (
                    <kicanvas-embed
                      key={`preview-viewer-${previewUrl}`}
                      src={previewUrl}
                      controls="basic"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                      <div className="text-center text-muted-foreground">
                        <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Preview will load after validation</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use mouse wheel to zoom, drag to pan. This preview is used to generate thumbnails.
                </p>
              </div>

              {/* Circuit Stats Cards */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="text-3xl font-bold text-primary mb-1">{metadata.stats.componentCount}</div>
                  <div className="text-sm text-muted-foreground">Components</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="text-3xl font-bold text-primary mb-1">{metadata.stats.wireCount}</div>
                  <div className="text-sm text-muted-foreground">Wires</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="text-3xl font-bold text-primary mb-1">{metadata.stats.netCount}</div>
                  <div className="text-sm text-muted-foreground">Nets</div>
                </div>
              </div>

              {/* Component List */}
              {metadata.components.length > 0 && (
                <div className="bg-muted/20 rounded-lg p-4 border mb-6">
                  <h3 className="font-semibold mb-3">Components Detected:</h3>
                  <div className="grid md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {metadata.components.map((comp, index) => (
                      <div key={index} className="text-sm flex items-start gap-2 p-2 bg-background rounded">
                        <span className="font-mono font-medium text-primary">{comp.reference}</span>
                        <span className="text-muted-foreground">{comp.value}</span>
                        {comp.footprint && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {comp.footprint.split(':')[1] || comp.footprint}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footprint Assignment Status */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {metadata.footprints.unassigned === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    Footprint Assignment: {metadata.footprints.assigned}/{metadata.footprints.assigned + metadata.footprints.unassigned}
                  </span>
                </div>
                {metadata.footprints.unassigned > 0 && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {metadata.footprints.unassigned} component(s) are missing footprint assignments.
                    This is normal for reusable subcircuits.
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep('paste')}
                  className="px-6 py-2 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinueToMetadata}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue to Details
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Metadata Form */}
          {currentStep === 'metadata' && (
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Add Circuit Details</h2>

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
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  />
                </div>

                {/* URL Slug */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="lm358-dual-op-amp-circuit"
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    circuitsnips.com/circuit/{slug || 'your-slug'}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this circuit does..."
                    rows={4}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-y bg-background"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  >
                    <option value="General">General</option>
                    <option value="Power Supply">Power Supply</option>
                    <option value="Analog">Analog</option>
                    <option value="Digital">Digital</option>
                    <option value="Microcontroller">Microcontroller</option>
                    <option value="Sensors">Sensors</option>
                    <option value="Communication">Communication</option>
                    <option value="Display/LED">Display/LED</option>
                    <option value="Control">Control</option>
                  </select>
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
                      className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
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
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  >
                    <option value="CERN-OHL-S-2.0">CERN-OHL-S-2.0 (Recommended)</option>
                    <option value="MIT">MIT</option>
                    <option value="CC-BY-4.0">CC-BY-4.0</option>
                    <option value="CC-BY-SA-4.0">CC-BY-SA-4.0</option>
                    <option value="GPL-3.0">GPL-3.0</option>
                    <option value="Apache-2.0">Apache-2.0</option>
                    <option value="BSD-2-Clause">BSD-2-Clause</option>
                    <option value="TAPR-OHL-1.0">TAPR-OHL-1.0</option>
                  </select>
                </div>

                {/* Visibility */}
                <div className="bg-muted/30 p-4 rounded-md">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm font-medium">Make this circuit public</span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isPublic
                          ? "Anyone can discover and view this circuit. You can change this later."
                          : "Only you can view this circuit. Others won't see it in search or browse."}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Terms agreement */}
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

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="px-6 py-2 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinueToThumbnails}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue to Publish
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Thumbnail Capture */}
          {currentStep === 'thumbnails' && (
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Generate Thumbnails</h2>
              <p className="text-muted-foreground mb-4">
                Click to automatically capture thumbnails in both light and dark modes.
              </p>

              {lightThumbnail && darkThumbnail ? (
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Light Mode</p>
                    <img src={lightThumbnail} alt="Light thumbnail" className="w-full border rounded" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Dark Mode</p>
                    <img src={darkThumbnail} alt="Dark thumbnail" className="w-full border rounded" />
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Preview (thumbnails will be captured from this):</p>
                  <div className="bg-background rounded-md overflow-hidden border" style={{ height: '450px' }} ref={viewerRef}>
                    {isLoadingPreview ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/20">
                        <div className="text-center">
                          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Loading preview...</p>
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <kicanvas-embed
                        key={`thumbnail-viewer-${previewUrl}`}
                        src={previewUrl}
                        controls="basic"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/20">
                        <div className="text-center text-muted-foreground">
                          <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Preview not available</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Preview URL: {previewUrl || 'Not loaded'}
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentStep('metadata')}
                  disabled={isCapturing || isUploading}
                  className="px-6 py-2 border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCaptureThumbnails}
                  disabled={isCapturing || isUploading}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isCapturing || isUploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      {isCapturing ? 'Capturing...' : uploadProgress}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Capture & Publish
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {currentStep === 'success' && (
            <div className="bg-card border rounded-lg p-6 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-semibold mb-2">Circuit Published!</h2>
              <p className="text-muted-foreground mb-4">
                Your circuit has been successfully uploaded and is now live.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to your circuit page...
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
