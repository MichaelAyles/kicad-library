/**
 * Check database migration status
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  // Count circuits with R2 URL set
  const { count: withR2, error: e1 } = await supabase
    .from("circuits")
    .select("id", { count: "exact", head: true })
    .not("schematic_r2_url", "is", null);

  // Count circuits without R2 URL
  const { count: withoutR2, error: e2 } = await supabase
    .from("circuits")
    .select("id", { count: "exact", head: true })
    .is("schematic_r2_url", null);

  // Total count
  const { count: total, error: e3 } = await supabase
    .from("circuits")
    .select("id", { count: "exact", head: true });

  console.log("Database Circuit Counts:");
  console.log("========================");
  console.log(`Total circuits: ${total}`);
  console.log(`With schematic_r2_url: ${withR2}`);
  console.log(`Without schematic_r2_url (need migration): ${withoutR2}`);

  if (e1) console.error("Error 1:", e1);
  if (e2) console.error("Error 2:", e2);
  if (e3) console.error("Error 3:", e3);
}

check();
