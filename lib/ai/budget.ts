import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Shared, serverless-safe ceiling on OpenAI-backed calls per UTC day. Backed by
// the `bump_llm_budget` RPC (0007) so it holds across all instances/cold starts,
// unlike the per-IP in-memory limiter. Bounds total spend regardless of how a
// bot distributes requests; the OpenAI dashboard usage limit is the hard backstop.
const DAILY_CAP = Math.max(1, Number(process.env.LLM_DAILY_CAP ?? 500));

// Counts one call for today and returns whether we're still within the cap.
// Fail-OPEN on any error (e.g. migration 0007 not applied yet) so the app keeps
// working — the dashboard spend limit still caps real cost.
export async function withinLlmBudget(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("bump_llm_budget", { p_max: DAILY_CAP });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}
