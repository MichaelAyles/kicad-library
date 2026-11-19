/**
 * Circuit pages are pre-built at deploy time for every public circuit. Any
 * other slug (a circuit created or made public since the last build, or a
 * private one) is served the generic shell page built for this placeholder
 * slug, which loads the circuit in the browser. See worker/assets.ts.
 */
export const SHELL_SLUG = "_";
