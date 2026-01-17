import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewCache } from "@/lib/preview-cache";

/**
 * Try to get a Supabase client for storage operations.
 */
async function getStorageClient() {
  try {
    const client = await createClient();
    return client;
  } catch {
    // Fallback to admin client if available
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
      // No client available
    }
  }
  return null;
}

/**
 * GET: Retrieve a preview schematic by ID from a filename-based URL
 * This route exists so KiCanvas can see the .kicad_sch extension in the URL path
 * Example: /api/preview/preview.kicad_sch?id=preview-123
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } },
) {
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
      console.log("Preview API [filename]: Retrieved from cache");
      return new NextResponse(cached.sexpr, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${params.filename}"`,
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
          console.log("Preview API [filename]: Retrieved from Supabase");

          // Cache for future requests
          previewCache.set(previewId, { sexpr: text, timestamp: Date.now() });

          return new NextResponse(text, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Disposition": `inline; filename="${params.filename}"`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        }
      } catch (e) {
        console.error("Preview API [filename]: Supabase download error:", e);
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
