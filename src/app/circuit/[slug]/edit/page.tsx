"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader, X, Trash2, Camera } from "lucide-react";
import { useTheme } from "next-themes";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getCircuitBySlug, type Circuit } from "@/lib/circuits";
import { useAuth } from "@/hooks/useAuth";
import { captureThumbnails, uploadThumbnail } from "@/lib/thumbnail";
import { createClient } from "@/lib/supabase/client";
import { wrapSnippetToFullFile, isClipboardSnippet } from "@/lib/kicad-parser";

const LICENSES = [
  "CERN-OHL-S-2.0",
  "MIT",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "GPL-3.0",
  "Apache-2.0",
  "TAPR-OHL-1.0",
  "BSD-2-Clause",
];

const CATEGORIES = [
  "Analog",
  "Digital",
  "Power",
  "Interface",
  "Sensors",
  "Microcontroller",
  "Communication",
  "Audio",
  "Other",
];

export default function EditCircuitPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thumbnail regeneration state
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false);
  const [showThumbnailPreview, setShowThumbnailPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [license, setLicense] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Load circuit data
  useEffect(() => {
    if (!slug) return;

    // Wait for auth to load before checking permissions
    if (authLoading) return;

    const loadCircuit = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const circuitData = await getCircuitBySlug(slug);

        if (!circuitData) {
          setError("Circuit not found");
          setIsLoading(false);
          return;
        }

        // Check if user is the owner
        console.log("Edit permission check:", {
          hasUser: !!user,
          userId: user?.id,
          circuitUserId: circuitData.user_id,
          matches: user?.id === circuitData.user_id
        });

        if (!user || circuitData.user_id !== user.id) {
          setError("You don't have permission to edit this circuit");
          setIsLoading(false);
          return;
        }

        setCircuit(circuitData);
        setTitle(circuitData.title);
        setDescription(circuitData.description);
        setTags(circuitData.tags);
        setCategory(circuitData.category || "");
        setLicense(circuitData.license);
        setIsPublic(circuitData.is_public);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load circuit:", err);
        setError(err instanceof Error ? err.message : "Failed to load circuit");
        setIsLoading(false);
      }
    };

    loadCircuit();
  }, [slug, user, authLoading]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 10) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!circuit) return;

    // Validation
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    if (tags.length === 0) {
      alert("Please add at least one tag");
      return;
    }

    if (!license) {
      alert("Please select a license");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/circuits/${circuit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          tags,
          category: category || null,
          license,
          is_public: isPublic,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update circuit");
      }

      // Redirect back to circuit detail page
      router.push(`/circuit/${slug}`);
    } catch (err) {
      console.error("Failed to update circuit:", err);
      setError(err instanceof Error ? err.message : "Failed to update circuit");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!circuit) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/circuits/${circuit.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete circuit");
      }

      // Redirect to profile page
      router.push("/profile");
    } catch (err) {
      console.error("Failed to delete circuit:", err);
      setError(err instanceof Error ? err.message : "Failed to delete circuit");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLoadPreview = async () => {
    if (!circuit) return;

    setIsRegeneratingThumbnails(true);
    setError(null);

    try {
      // Create preview URL from raw sexpr
      let fullFile = circuit.raw_sexpr;
      if (isClipboardSnippet(circuit.raw_sexpr)) {
        fullFile = wrapSnippetToFullFile(circuit.raw_sexpr, {
          title: circuit.title,
          uuid: circuit.id
        });
      }

      // Store preview in Supabase
      const supabase = createClient();
      const previewId = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const { error: uploadError } = await supabase.storage
        .from('previews')
        .upload(`${previewId}.kicad_sch`, fullFile, {
          contentType: 'text/plain',
          upsert: true,
        });

      if (uploadError) {
        throw new Error('Failed to create preview');
      }

      const newPreviewUrl = `/api/preview/preview.kicad_sch?id=${previewId}`;
      setPreviewUrl(newPreviewUrl);
      setShowThumbnailPreview(true);
    } catch (err) {
      console.error('Failed to load preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  };

  const handleCaptureThumbnails = async () => {
    if (!circuit || !user || !previewUrl) return;

    setIsRegeneratingThumbnails(true);
    setError(null);

    try {
      // Wait for viewer to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture thumbnails
      const kicanvasElement = viewerRef.current;
      if (!kicanvasElement) {
        throw new Error('Viewer element not found');
      }

      const currentTheme = theme === 'dark' ? 'dark' : 'light';
      const thumbnails = await captureThumbnails(
        kicanvasElement,
        currentTheme,
        (newTheme) => setTheme(newTheme)
      );

      const supabase = createClient();

      // Upload new thumbnails
      const lightUrl = await uploadThumbnail(supabase, user.id, circuit.id, 'light', thumbnails.light);
      const darkUrl = await uploadThumbnail(supabase, user.id, circuit.id, 'dark', thumbnails.dark);

      // Update circuit with new thumbnail URLs
      const response = await fetch(`/api/circuits/${circuit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thumbnail_light_url: lightUrl,
          thumbnail_dark_url: darkUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update thumbnails');
      }

      // Clean up preview
      const previewId = previewUrl.split('id=')[1];
      await supabase.storage.from('previews').remove([`${previewId}.kicad_sch`]);

      // Reload circuit to show new thumbnails
      const updatedCircuit = await getCircuitBySlug(slug);
      if (updatedCircuit) {
        setCircuit(updatedCircuit);
      }

      setShowThumbnailPreview(false);
      setPreviewUrl(null);
      alert('Thumbnails regenerated successfully!');
    } catch (err) {
      console.error('Failed to capture thumbnails:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture thumbnails');
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  };

  // Loading state
  if (isLoading || authLoading) {
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

  // Error state
  if (error || !circuit) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <Link
              href={slug ? `/circuit/${slug}` : "/browse"}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="bg-card border rounded-lg p-12 text-center">
              <h1 className="text-2xl font-bold mb-2">Cannot Edit Circuit</h1>
              <p className="text-muted-foreground mb-6">{error || "An error occurred"}</p>
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

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <Link
            href={`/circuit/${slug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Circuit
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Edit Circuit</h1>
            <p className="text-muted-foreground">
              Update metadata for your circuit. The schematic data cannot be changed.
            </p>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                placeholder="e.g., LM358 Op-Amp Circuit"
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description <span className="text-destructive">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[120px]"
                placeholder="Describe what this circuit does, its key features, and how to use it..."
                maxLength={1000}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {description.length}/1000 characters
              </p>
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="block text-sm font-medium mb-2">
                Tags <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="Add tags (press Enter)"
                  maxLength={30}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  disabled={tags.length >= 10}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-md flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {tags.length}/10 tags. Tags help others discover your circuit.
              </p>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              >
                <option value="">Select a category (optional)</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* License */}
            <div>
              <label htmlFor="license" className="block text-sm font-medium mb-2">
                License <span className="text-destructive">*</span>
              </label>
              <select
                id="license"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                required
              >
                <option value="">Select a license</option>
                {LICENSES.map((lic) => (
                  <option key={lic} value={lic}>
                    {lic}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose an open source hardware license. Cannot be changed after upload.
              </p>
            </div>

            {/* Visibility */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Make this circuit public</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Public circuits can be discovered and copied by anyone
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>

              <Link
                href={`/circuit/${slug}`}
                className="px-6 py-3 border rounded-md font-medium hover:bg-muted/50 transition-colors flex items-center gap-2"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Regenerate Thumbnails Section */}
          <div className="mt-8 p-6 border border-primary/30 bg-primary/5 rounded-lg">
            <h3 className="font-semibold text-primary mb-2">Regenerate Thumbnails</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Update the circuit thumbnails. First load the preview to verify it looks correct, then capture new screenshots in both light and dark modes.
            </p>

            {showThumbnailPreview && previewUrl ? (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Preview (verify this looks correct before capturing):</p>
                <div className="bg-background rounded-md overflow-hidden border" style={{ height: '400px' }} ref={viewerRef}>
                  <kicanvas-embed
                    src={previewUrl}
                    controls="basic"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex gap-3">
              {!showThumbnailPreview ? (
                <button
                  onClick={handleLoadPreview}
                  disabled={isRegeneratingThumbnails}
                  className="px-4 py-2 border border-primary text-primary rounded-md font-medium hover:bg-primary/10 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegeneratingThumbnails ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Loading Preview...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Load Preview
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCaptureThumbnails}
                    disabled={isRegeneratingThumbnails}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegeneratingThumbnails ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Capturing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Capture Thumbnails
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowThumbnailPreview(false);
                      setPreviewUrl(null);
                    }}
                    disabled={isRegeneratingThumbnails}
                    className="px-4 py-2 border rounded-md font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Delete Circuit Section */}
          <div className="mt-8 p-6 border border-destructive/30 bg-destructive/5 rounded-lg">
            <h3 className="font-semibold text-destructive mb-2">Delete Circuit</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete this circuit. This action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-destructive text-destructive rounded-md font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Circuit
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">
                  Are you sure you want to delete &quot;{circuit?.title}&quot;? This will permanently remove:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>The circuit and all its data</li>
                  <li>All comments on this circuit</li>
                  <li>All favorites and view statistics</li>
                </ul>

                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Yes, Delete Permanently
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 border rounded-md font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
