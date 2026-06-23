import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/data";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Manual scrape trigger (admin only). Playwright can't run inside a serverless
// request, so this endpoint *enqueues* a run: it writes a `queued` row into
// `scrape_runs` (admin-gated by RLS). A host running
// `node scrapers/run.mjs --from-queue` on a schedule drains the queue and does
// the actual crawling/ingest. See SCRAPING.md.
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: false, status: "notConfigured" }, { status: 503 });
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, status: "notAuthorized" }, { status: 403 });

  // Optional { source } in the body; default to all registered sources.
  let source = "all";
  try {
    const body = await request.json();
    if (body && typeof body.source === "string") source = body.source;
  } catch {
    /* no body → all sources */
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scrape_runs")
    .insert({ source, trigger: "manual", triggered_by: admin.id, status: "queued" })
    .select("id, source, status, queued_at")
    .single();

  if (error) return NextResponse.json({ ok: false, status: "error" }, { status: 500 });
  return NextResponse.json({ ok: true, status: "queued", run: data });
}
