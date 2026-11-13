import type { ParsedMetadata } from "@/lib/kicad-parser";

/**
 * The parts of a parsed schematic that the circuit detail page displays.
 *
 * The full ParsedMetadata carries positions, properties and nets for every
 * symbol; this keeps only what the page renders so it stays small when the
 * server passes it to the client component.
 */
export interface CircuitPartsSummary {
  components: Array<{
    reference: string;
    value: string;
    footprint: string;
  }>;
  stats: {
    componentCount: number;
    wireCount: number;
    netCount: number;
  };
  footprints: {
    assigned: number;
  };
  boundingBox: ParsedMetadata["boundingBox"];
}

export function summarizeMetadata(
  metadata: ParsedMetadata,
): CircuitPartsSummary {
  return {
    components: metadata.components.map((c) => ({
      reference: c.reference,
      value: c.value,
      footprint: c.footprint,
    })),
    stats: {
      componentCount: metadata.stats.componentCount,
      wireCount: metadata.stats.wireCount,
      netCount: metadata.stats.netCount,
    },
    footprints: { assigned: metadata.footprints.assigned },
    boundingBox: metadata.boundingBox,
  };
}
