"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader, X, Trash2, Camera, History } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { KiCanvas } from "@/components/KiCanvas";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { getCircuitBySlug, type Circuit } from "@/lib/circuits";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/admin";
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

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // Thumbnail regeneration state
  const [isRegeneratingThumbnails, setIsRegeneratingThumbnails] = useState(false);
  const [showThumbnailPreview, setShowThumbnailPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const lightContainerRef = useRef<HTMLDivElement>(null);
  const darkContainerRef = useRef<HTMLDivElement>(null);

  // Thumbnail version history
  const [thumbnailHistory, setThumbnailHistory] = useState<any[]>([]);
  const [showVersionSelector, setShowVersionSelector] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [license, setLicense] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        const adminStatus = await isAdmin(user);
        setIsUserAdmin(adminStatus);
      }
    };
    checkAdminStatus();
  }, [user]);

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

        // Check if user is the owner or admin
        const userIsAdmin = user ? await isAdmin(user) : false;
        const isOwner = user?.id === circuitData.user_id;

        console.log("Edit permission check:", {
          hasUser: !!user,
          userId: user?.id,
          circuitUserId: circuitData.user_id,
          isOwner,
          isAdmin: userIsAdmin
        });

        if (!user || (!isOwner && !userIsAdmin)) {
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

    if (!lightContainerRef.current || !darkContainerRef.current) {
      setError('Viewers not ready. Please wait for both previews to load.');
      return;
    }

    setIsRegeneratingThumbnails(true);
    setError(null);

    try {
      // Wait for viewers to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture thumbnails from both containers
      const thumbnails = await captureThumbnails(
        lightContainerRef.current,
        darkContainerRef.current
      );

      const supabase = createClient();

      // Fetch current thumbnail version from database
      const { data: circuitData, error: fetchError } = await supabase
        .from('circuits')
        .select('thumbnail_version')
        .eq('id', circuit.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch circuit version: ${fetchError.message}`);
      }

      const currentVersion = circuitData?.thumbnail_version || 0;
      const newVersion = currentVersion + 1;

      console.log(`Version detection: DB version=${currentVersion}, Next=${newVersion}`);

      // Upload new thumbnails with incremented version
      const lightUrl = await uploadThumbnail(supabase, user.id, circuit.id, 'light', thumbnails.light, newVersion);
      const darkUrl = await uploadThumbnail(supabase, user.id, circuit.id, 'dark', thumbnails.dark, newVersion);

      // Update circuit with new thumbnail URLs and version
      const response = await fetch(`/api/circuits/${circuit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thumbnail_light_url: lightUrl,
          thumbnail_dark_url: darkUrl,
          thumbnail_version: newVersion,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update thumbnails');
      }

      // Clean up preview
      const previewId = previewUrl.split('id=')[1];
      await supabase.storage.from('previews').remove([`${previewId}.kicad_sch`]);

      setShowThumbnailPreview(false);
      setPreviewUrl(null);

      // Redirect back to circuit detail page to show new thumbnails
      // This ensures fresh data is loaded from the database
      router.push(`/circuit/${slug}`);
    } catch (err) {
      console.error('Failed to capture thumbnails:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture thumbnails');
    } finally {
      setIsRegeneratingThumbnails(false);
    }
  };

  // Load thumbnail version history
  const loadThumbnailHistory = async () => {
    if (!circuit) return;

    setIsLoadingHistory(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('thumbnail_history')
        .select('*')
        .eq('circuit_id', circuit.id)
        .order('version', { ascending: false });

      if (error) throw error;

      setThumbnailHistory(data || []);
      setShowVersionSelector(true);
    } catch (err) {
      console.error('Failed to load thumbnail history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load thumbnail history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Set active thumbnail version
  const setActiveVersion = async (versionId: string, version: number, lightUrl: string, darkUrl: string) => {
    if (!circuit) return;

    try {
      const supabase = createClient();

      // Mark all versions as not current
      await supabase
        .from('thumbnail_history')
        .update({ is_current: false })
        .eq('circuit_id', circuit.id);

      // Mark selected version as current
      await supabase
        .from('thumbnail_history')
        .update({ is_current: true })
        .eq('id', versionId);

      // Update circuit with selected thumbnail URLs and version
      const { error: updateError } = await supabase
        .from('circuits')
        .update({
          thumbnail_light_url: lightUrl,
          thumbnail_dark_url: darkUrl,
          thumbnail_version: version,
        })
        .eq('id', circuit.id);

      if (updateError) throw updateError;

      // Reload circuit data
      const updatedCircuit = await getCircuitBySlug(slug);
      if (updatedCircuit) {
        setCircuit(updatedCircuit);
      }

      // Reload history
      await loadThumbnailHistory();

      alert(`Thumbnail version ${version} is now active`);
    } catch (err) {
      console.error('Failed to set active version:', err);
      setError(err instanceof Error ? err.message : 'Failed to set active version');
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
                maxLength={150}
                required
              />
              <p className={`text-xs mt-1 ${title.length >= 135 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {title.length}/150 characters
              </p>
            </div>

            {/* Description */}
            <MarkdownEditor
              label="Description"
              required
              value={description}
              onChange={setDescription}
              maxLength={10000}
              placeholder="Describe what this circuit does, its key features, and how to use it... (Markdown supported)"
              minRows={5}
              maxRows={15}
            />

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
                <p className="text-sm font-medium mb-3">Live Previews (thumbnails will be captured from these):</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Light Mode Preview */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Light Mode (kicad theme)</p>
                    <div
                      ref={lightContainerRef}
                      className="rounded-md overflow-hidden border-2 border-gray-300"
                      style={{ height: '300px' }}
                    >
                      <KiCanvas
                        key={`light-${previewUrl}`}
                        src={previewUrl}
                        theme="kicad"
                        controls="none"
                        height="100%"
                        width="100%"
                      />
                    </div>
                  </div>

                  {/* Dark Mode Preview */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Dark Mode (witchhazel theme)</p>
                    <div
                      ref={darkContainerRef}
                      className="rounded-md overflow-hidden border-2 border-gray-600 bg-gray-900"
                      style={{ height: '300px' }}
                    >
                      <KiCanvas
                        key={`dark-${previewUrl}`}
                        src={previewUrl}
                        theme="witchhazel"
                        controls="none"
                        height="100%"
                        width="100%"
                      />
                    </div>
                  </div>
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

          {/* Thumbnail Version History Section */}
          <div className="mt-8 p-6 border border-blue-500/30 bg-blue-500/5 rounded-lg">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
              <History className="w-5 h-5" />
              Thumbnail Version History
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              View all thumbnail versions and select which one to display. Current version: v{circuit?.thumbnail_version || 1}
            </p>

            {!showVersionSelector ? (
              <button
                onClick={loadThumbnailHistory}
                disabled={isLoadingHistory}
                className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isLoadingHistory ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4" />
                    View All Versions
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Select Active Version</h4>
                  <button
                    onClick={() => setShowVersionSelector(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>

                {thumbnailHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No thumbnail history found.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {thumbnailHistory.map((version) => (
                      <div
                        key={version.id}
                        className={`border rounded-lg p-4 ${
                          version.is_current
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-muted hover:border-blue-500/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-semibold">
                              Version {version.version}
                              {version.is_current && (
                                <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
                                  ACTIVE
                                </span>
                              )}
                            </h5>
                            <p className="text-xs text-muted-foreground">
                              {new Date(version.regenerated_at).toLocaleString()}
                            </p>
                            {version.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1">{version.notes}</p>
                            )}
                          </div>
                        </div>

                        {/* Thumbnail Previews */}
                        <div className="space-y-2 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Light Mode:</p>
                            <img
                              src={version.thumbnail_light_url}
                              alt={`Version ${version.version} light`}
                              className="w-full border rounded"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Dark Mode:</p>
                            <img
                              src={version.thumbnail_dark_url}
                              alt={`Version ${version.version} dark`}
                              className="w-full border rounded"
                            />
                          </div>
                        </div>

                        {!version.is_current && (
                          <button
                            onClick={() =>
                              setActiveVersion(
                                version.id,
                                version.version,
                                version.thumbnail_light_url,
                                version.thumbnail_dark_url
                              )
                            }
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            Set as Active
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
