import { NextRequest, NextResponse } from "next/server";
import { isClipboardSnippet, wrapSnippetToFullFile } from "@/lib/kicad-parser";
import { createClient } from "@/lib/supabase/server";
import { previewCache } from "@/lib/preview-cache";

/**
 * Try to get a Supabase client that can upload to storage.
 * Falls back to null if no valid client available.
 */
async function getStorageClient() {
  // First try regular auth client (works if user is authenticated)
  try {
    const client = await createClient();
    return client;
  } catch {
    console.log("Preview API: Auth client not available");
  }

  // Then try admin client (works if service role key is set)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceRoleKey) {
      const { createClient: createAdminClient } = await import(
        "@supabase/supabase-js"
      );
      return createAdminClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  } catch {
    console.log("Preview API: Admin client not available");
  }

  return null;
}

/**
 * POST: Store a preview schematic and return its ID
 * Tries Supabase storage first (persists across serverless instances),
 * falls back to in-memory cache if storage unavailable.
 */
export async function POST(request: NextRequest) {
  try {
    const { sexpr } = await request.json();

    if (!sexpr || typeof sexpr !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sexpr data" },
        { status: 400 },
      );
    }

    // Ensure we have a full KiCad file (not just a snippet)
    // KiCanvas requires a complete .kicad_sch file structure
    let fullFile = sexpr;
    if (isClipboardSnippet(sexpr)) {
      console.log("Preview API: Wrapping clipboard snippet into full file");
      fullFile = wrapSnippetToFullFile(sexpr, {
        title: "Circuit Preview",
        uuid: `preview-${Date.now()}`,
      });
    } else {
      console.log("Preview API: Already a full file, using as-is");
    }

    // Generate unique preview ID
    const previewId = `preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Try Supabase storage first
    const supabase = await getStorageClient();
    let storedInSupabase = false;

    if (supabase) {
      try {
        const { error: uploadError } = await supabase.storage
          .from("previews")
          .upload(`${previewId}.kicad_sch`, fullFile, {
            contentType: "text/plain",
            upsert: true,
          });

        if (!uploadError) {
          storedInSupabase = true;
          console.log("Preview API: Stored in Supabase storage");
        } else {
          console.error("Preview API: Supabase upload failed:", uploadError);
        }
      } catch (e) {
        console.error("Preview API: Supabase storage error:", e);
      }
    }

    // Always store in cache as well (for same-instance requests)
    previewCache.set(previewId, {
      sexpr: fullFile,
      timestamp: Date.now(),
    });
    console.log(
      `Preview API: Stored in cache${storedInSupabase ? " (also in Supabase)" : " (Supabase unavailable)"}`,
    );

    return NextResponse.json({ previewId });
  } catch (error) {
    console.error("Preview POST error:", error);
    return NextResponse.json(
      { error: "Failed to create preview" },
      { status: 500 },
    );
  }
}

/**
 * GET: Retrieve a preview schematic by ID
 * Tries in-memory cache first (fast), then Supabase storage.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const previewId = searchParams.get("id");

    if (!previewId) {
      return NextResponse.json(
        { error: "Missing preview ID" },
        { status: 400 },
      );
    }

    // Try cache first (fast, same-instance)
    const cached = previewCache.get(previewId);
    if (cached) {
      console.log("Preview API: Retrieved from cache");
      return new NextResponse(cached.sexpr, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": 'inline; filename="preview.kicad_sch"',
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Try Supabase storage (cross-instance)
    const supabase = await getStorageClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from("previews")
          .download(`${previewId}.kicad_sch`);

        if (!error && data) {
          const text = await data.text();
          console.log("Preview API: Retrieved from Supabase storage");

          // Cache it for future requests
          previewCache.set(previewId, { sexpr: text, timestamp: Date.now() });

          return new NextResponse(text, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Disposition": 'inline; filename="preview.kicad_sch"',
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }
      } catch (e) {
        console.error("Preview API: Supabase download error:", e);
      }
    }

    console.error("Preview not found:", previewId);
    return NextResponse.json(
      { error: "Preview not found or expired" },
      { status: 404 },
    );
  } catch (error) {
    console.error("Preview GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve preview" },
      { status: 500 },
    );
  }
}
