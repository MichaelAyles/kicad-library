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
  // The full S-expression will be loaded from the public file
  sexprPath: "/example-Knock-Sensor.txt",
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

/**
 * Load the full S-expression for the knock sensor circuit
 * This fetches the raw S-expression data from the public folder
 */
export async function loadKnockSensorSexpr(): Promise<string> {
  const response = await fetch('/example-Knock-Sensor.txt');
  if (!response.ok) {
    throw new Error('Failed to load knock sensor S-expression');
  }
  return await response.text();
}
