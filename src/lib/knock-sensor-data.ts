/**
 * Knock Sensor Circuit Data
 * Real circuit example for CircuitSnips MVP
 */

export const knockSensorCircuit = {
  id: "1",
  slug: "tpic8101-knock-sensor-interface",
  title: "TPIC8101 Automotive Knock Sensor Interface",
  description: "Dual-channel knock sensor interface circuit using Texas Instruments TPIC8101DWRG4. Designed for automotive engine knock detection with integrated signal conditioning, bandpass filtering, and SPI interface. Includes differential inputs, programmable gain, and interrupt capability.",
  user: {
    username: "mikeayles",
    avatarUrl: null,
  },
  copyCount: 0,
  favoriteCount: 0,
  viewCount: 0,
  tags: ["automotive", "sensor", "knock-sensor", "TPIC8101", "analog", "SPI", "differential"],
  category: "Sensor Interface",
  license: "CERN-OHL-S-2.0",
  createdAt: new Date("2024-01-20"),
  uuid: "knock-sensor-example-001",
  // Path to the raw S-expression data (single source of truth)
  dataPath: "/example-Knock-Sensor.txt",
  metadata: {
    components: [
      { reference: "IC19", value: "TPIC8101DWRG4", footprint: "SOIC127P1030X265-20N", lib_id: "SamacSys_Parts:TPIC8101DWRG4" },
      { reference: "C?", value: "100nF", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:C" },
      { reference: "C?", value: "1uF", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:C" },
      { reference: "R?", value: "10k", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:R" },
      { reference: "R?", value: "100k", footprint: "Resistor_SMD:R_0805_2012Metric", lib_id: "Device:R" },
    ],
    stats: {
      componentCount: 29,
      wireCount: 45,
      netCount: 35,
    },
    footprints: {
      assigned: 29,
      unassigned: 0,
    },
  },
};

import { wrapWithKiCadHeaders } from './parser';

// Cache for the loaded data to avoid repeated fetches
let cachedRawData: string | null = null;

/**
 * Load the raw S-expression data (single source of truth)
 * This is the base data that everything else is derived from
 */
async function loadRawData(): Promise<string> {
  if (cachedRawData) {
    return cachedRawData;
  }

  const response = await fetch(knockSensorCircuit.dataPath);
  if (!response.ok) {
    throw new Error('Failed to load knock sensor data');
  }

  cachedRawData = await response.text();
  return cachedRawData;
}

/**
 * Load the raw clipboard data for copy/paste into KiCad
 * Returns the data exactly as it should be pasted (no headers, no modifications)
 */
export async function loadKnockSensorClipboardData(): Promise<string> {
  return await loadRawData();
}

/**
 * Load the complete KiCad schematic file for viewer and downloads
 * Dynamically wraps the raw data with proper KiCad headers
 */
export async function loadKnockSensorSchematicFile(): Promise<string> {
  const rawData = await loadRawData();

  return wrapWithKiCadHeaders(rawData, {
    title: knockSensorCircuit.title,
    uuid: knockSensorCircuit.uuid,
  });
}
