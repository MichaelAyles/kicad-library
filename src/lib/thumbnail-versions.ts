/**
 * Server-only: thumbnail version allocation and history.
 *
 * Thumbnails live at immutable R2 keys, `thumbnails/<id>/v<N>-<theme>.png`,
 * cached for a year. A version number must therefore never be reused, even
 * after its files or history rows are deleted or the circuit is rolled back
 * to an older version. circuits.thumbnail_version is the allocation counter:
 * each upload reserves a fresh number with an optimistic lock on it before
 * writing any object.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { listCircuitThumbnails } from "@/lib/r2-schematic";

/**
 * Version numbers above this are ignored when computing the next version, so
 * a bad value in the DB, R2 or history (thumbnail_version is client-writable
 * through some paths) can't push allocation towards INT_MAX.
 */
export const MAX_THUMBNAIL_VERSION = 1_000_000;

const MAX_ATTEMPTS = 4;

function sane(version: number | null | undefined): number {
  return typeof version === "number" &&
    Number.isInteger(version) &&
    version > 0 &&
    version <= MAX_THUMBNAIL_VERSION
    ? version
    : 0;
}

export type VersionReservation =
  | { ok: true; version: number }
  | { ok: false; reason: "conflict" | "not_found" | "exhausted" };

/**
 * Atomically reserve the next unused thumbnail version for a circuit.
 *
 * next = max(thumbnail_version, highest version in R2, highest version in
 * thumbnail_history) + 1, written with
 * `UPDATE circuits SET thumbnail_version = next
 *  WHERE id = X AND thumbnail_version IS NOT DISTINCT FROM <value read>`
 * and retried when another request got there first.
 *
 * @param circuitId lowercase circuit UUID
 * @param dbVersion circuits.thumbnail_version as already read by the caller
 */
export async function reserveThumbnailVersion(
  circuitId: string,
  dbVersion: number | null,
): Promise<VersionReservation> {
  const admin = createAdminClient();

  const [stored, historyResult] = await Promise.all([
    listCircuitThumbnails(circuitId),
    admin
      .from("thumbnail_history")
      .select("version")
      .eq("circuit_id", circuitId)
      .lte("version", MAX_THUMBNAIL_VERSION)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (historyResult.error) {
    throw new Error(
      `Failed to read thumbnail history: ${historyResult.error.message}`,
    );
  }
  const usedFloor = Math.max(
    sane(historyResult.data?.version),
    ...stored.map((t) => sane(t.version)),
  );

  let current = dbVersion;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const next = Math.max(sane(current), usedFloor) + 1;
    if (next > MAX_THUMBNAIL_VERSION) return { ok: false, reason: "exhausted" };

    const update = admin
      .from("circuits")
      .update({ thumbnail_version: next })
      .eq("id", circuitId);
    const { data, error } = await (
      current === null
        ? update.is("thumbnail_version", null)
        : update.eq("thumbnail_version", current)
    )
      .select("thumbnail_version")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to reserve thumbnail version: ${error.message}`);
    }
    if (data) return { ok: true, version: next };

    // Someone else changed thumbnail_version; re-read and try again
    const { data: refreshed, error: readError } = await admin
      .from("circuits")
      .select("thumbnail_version")
      .eq("id", circuitId)
      .maybeSingle();
    if (readError) {
      throw new Error(`Failed to read circuit: ${readError.message}`);
    }
    if (!refreshed) return { ok: false, reason: "not_found" };
    current = refreshed.thumbnail_version;
  }
  return { ok: false, reason: "conflict" };
}

/**
 * Record a version in thumbnail_history and make it the only current one.
 * The new row is written (as current) before the others are cleared, so a
 * failure part-way never leaves the circuit without a current row.
 * Returns an error message, or null on success.
 */
export async function recordThumbnailHistory(entry: {
  circuitId: string;
  version: number;
  lightUrl: string;
  darkUrl: string;
  regeneratedBy: string;
  notes: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { error: upsertError } = await admin.from("thumbnail_history").upsert(
    {
      circuit_id: entry.circuitId,
      version: entry.version,
      thumbnail_light_url: entry.lightUrl,
      thumbnail_dark_url: entry.darkUrl,
      regenerated_by: entry.regeneratedBy,
      regenerated_at: new Date().toISOString(),
      is_current: true,
      notes: entry.notes,
    },
    { onConflict: "circuit_id,version" },
  );
  if (upsertError) return upsertError.message;

  const { error: clearError } = await admin
    .from("thumbnail_history")
    .update({ is_current: false })
    .eq("circuit_id", entry.circuitId)
    .eq("is_current", true)
    .neq("version", entry.version);
  return clearError ? clearError.message : null;
}
