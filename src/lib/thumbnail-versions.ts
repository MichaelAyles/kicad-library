/**
 * Server-only: thumbnail version allocation and history for the Next routes.
 *
 * The logic (and the reasoning behind it) lives in thumbnail-versions-core.ts;
 * this binds it to the service-role client and the AWS SDK R2 client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { listCircuitThumbnails } from "@/lib/r2-schematic";
import {
  recordThumbnailHistoryWith,
  reserveThumbnailVersionWith,
  type ThumbnailHistoryEntry,
  type VersionReservation,
} from "@/lib/thumbnail-versions-core";

export {
  MAX_THUMBNAIL_VERSION,
  type VersionReservation,
} from "@/lib/thumbnail-versions-core";

/** Atomically reserve the next unused thumbnail version for a circuit. */
export function reserveThumbnailVersion(
  circuitId: string,
  dbVersion: number | null,
): Promise<VersionReservation> {
  return reserveThumbnailVersionWith(
    {
      admin: createAdminClient(),
      listCircuitThumbnails: (id) => listCircuitThumbnails(id),
    },
    circuitId,
    dbVersion,
  );
}

/** Record a version in thumbnail_history and make it the only current one. */
export function recordThumbnailHistory(
  entry: ThumbnailHistoryEntry,
): Promise<string | null> {
  return recordThumbnailHistoryWith(createAdminClient(), entry);
}
