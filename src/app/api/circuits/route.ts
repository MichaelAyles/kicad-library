import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateSExpression } from "@/lib/kicad-parser";
import {
  deleteSchematic,
  processAndUploadSchematic,
} from "@/lib/r2-schematic";
import { MAX_RAW_SEXPR_BYTES } from "@/lib/circuit-limits";
import {
  CreateCircuitSchema,
  baseSlugFor,
  type CreateCircuitInput,
} from "@/lib/circuit-input";

// JSON escaping (quotes, newlines) can roughly double the schematic's size on
// the wire, so allow headroom over the raw_sexpr cap before parsing the body.
const MAX_BODY_BYTES = 3 * MAX_RAW_SEXPR_BYTES;
const MAX_SLUG_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

/**
 * Find the first free slug among base, base-2, base-3, ... using the admin
 * client, which sees every row (including other users' private circuits).
 */
async function findAvailableSlug(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  // base only contains [a-z0-9-], so it has no regex metacharacters. Match
  // exactly base and base-<n>, not every slug that merely starts with base.
  const { data, error } = await admin
    .from("circuits")
    .select("slug")
    .filter("slug", "match", `^${base}(-[0-9]+)?$`);
  if (error) throw error;

  const taken = new Set((data ?? []).map((row) => row.slug as string));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

function badRequest(error: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status: 400 },
  );
}

/**
 * POST /api/circuits
 * Create a circuit for the signed-in user.
 *
 * Validates the input and the schematic on the server, derives the schematic
 * stats, picks a unique slug, inserts the row and uploads the processed
 * schematic to R2. If the R2 step fails the row is deleted, so a circuit
 * either exists with its schematic or not at all. Thumbnails are uploaded
 * afterwards by the client via /api/upload-thumbnail.
 *
 * Returns { id, slug }.
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized - Please sign in" },
      { status: 401 },
    );
  }

  // Parse the body with a size cap
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large" },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = CreateCircuitSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      "Invalid circuit data",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  const input: CreateCircuitInput = parsed.data;

  // Re-validate the schematic server-side and derive its stats
  const validation = validateSExpression(input.raw_sexpr);
  if (!validation.valid || !validation.metadata) {
    return badRequest("Invalid KiCad schematic", validation.errors);
  }
  const { stats } = validation.metadata;

  const baseSlug = baseSlugFor(input);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("POST /api/circuits: admin client unavailable:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  // Insert, retrying with a fresh slug if another insert takes ours first
  let circuit: { id: string; slug: string } | null = null;
  try {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !circuit; attempt++) {
      const slug = await findAvailableSlug(admin, baseSlug);
      const { data, error } = await admin
        .from("circuits")
        .insert({
          user_id: user.id,
          slug,
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          license: input.license,
          is_public: input.is_public,
          sheet_size: input.sheet_size,
          raw_sexpr: input.raw_sexpr,
          component_count: stats.componentCount,
          wire_count: stats.wireCount,
          net_count: stats.netCount,
          // No thumbnails yet; the first upload reserves v1
          thumbnail_version: 0,
        })
        .select("id, slug")
        .single();

      if (!error) {
        circuit = data;
      } else if (error.code !== UNIQUE_VIOLATION) {
        throw error;
      }
    }
  } catch (error) {
    console.error("POST /api/circuits: insert failed:", error);
    return NextResponse.json(
      { error: "Failed to create circuit" },
      { status: 500 },
    );
  }

  if (!circuit) {
    return NextResponse.json(
      { error: "Could not find an available URL slug, please try again" },
      { status: 409 },
    );
  }

  // Upload the processed schematic to R2. Undo the insert on failure.
  let uploaded = false;
  try {
    const r2Url = await processAndUploadSchematic({
      circuitId: circuit.id,
      rawSexpr: input.raw_sexpr,
      title: input.title,
      sheetSizeOverride: input.sheet_size,
    });
    uploaded = true;

    const { error } = await admin
      .from("circuits")
      .update({ schematic_r2_url: r2Url })
      .eq("id", circuit.id);
    if (error) throw error;
  } catch (error) {
    console.error("POST /api/circuits: schematic upload failed:", error);

    const { error: deleteError } = await admin
      .from("circuits")
      .delete()
      .eq("id", circuit.id);
    if (deleteError) {
      console.error(
        `POST /api/circuits: failed to roll back circuit ${circuit.id}:`,
        deleteError,
      );
    }
    if (uploaded) {
      await deleteSchematic(circuit.id).catch((r2Error) =>
        console.error("POST /api/circuits: R2 cleanup failed:", r2Error),
      );
    }

    return NextResponse.json(
      { error: "Failed to store schematic, please try again" },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { id: circuit.id, slug: circuit.slug },
    { status: 201 },
  );
}
