import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCriteria, isOpenAIConfigured, type ChatMessage } from "@/lib/ai/openai";
import { withinLlmBudget } from "@/lib/ai/budget";
import { fetchLocations } from "@/lib/listings/query";
import type { Lang } from "@/lib/i18n/translations";

// ── Guardrails (per-instance, in-memory) ────────────────────────────────────
const MAX_MESSAGES = 12; // only the most recent turns are sent to the model
const MAX_CONTENT = 1000; // chars per message
const RL_MAX = 20; // requests
const RL_WINDOW_MS = 5 * 60 * 1000; // per 5 minutes per IP
const CACHE_TTL_MS = 10 * 60 * 1000;

const rateLog = new Map<string, number[]>();
const cache = new Map<string, { value: unknown; expires: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLog.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  hits.push(now);
  rateLog.set(ip, hits);
  return hits.length > RL_MAX;
}

export async function POST(request: NextRequest) {
  if (!isOpenAIConfigured) {
    return NextResponse.json({ configured: false });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }

  let body: { messages?: ChatMessage[]; lang?: Lang; sessionId?: string; type?: "sale" | "rent" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  const lang: Lang = body.lang === "hr" ? "hr" : "en";
  const type = body.type === "sale" || body.type === "rent" ? body.type : undefined;
  const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CONTENT) }));

  if (!messages.some((m) => m.role === "user")) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }

  // Cache identical conversations to bound OpenAI spend.
  const cacheKey = `${lang}:${type ?? "all"}:${JSON.stringify(messages)}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json(hit.value);
  }

  // Shared daily cap (serverless-safe) — a cache miss means we're about to make a
  // real OpenAI call, so count it against the global budget first.
  if (!(await withinLlmBudget())) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }

  let criteria;
  try {
    const locations = await fetchLocations(type);
    criteria = await extractCriteria(messages, locations, lang);
  } catch (e) {
    console.error("AI extract error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "aiError" }, { status: 502 });
  }
  if (!criteria) return NextResponse.json({ configured: false });

  // Best-effort: persist the turn for signed-in users (conversation memory).
  let sessionId = body.sessionId;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (!sessionId) {
        const { data } = await supabase
          .from("ai_sessions")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        sessionId = data?.id;
      }
      if (sessionId) {
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const rows: {
          session_id: string;
          role: "user" | "assistant";
          content: string;
          extracted_criteria?: unknown;
        }[] = [];
        if (lastUser) rows.push({ session_id: sessionId, role: "user", content: lastUser.content });
        rows.push({
          session_id: sessionId,
          role: "assistant",
          content: criteria.reply,
          extracted_criteria: criteria,
        });
        await supabase.from("ai_messages").insert(rows);
      }
    }
  } catch {
    // logging is non-critical — never fail the request because of it
  }

  const value = { configured: true, criteria, reply: criteria.reply, sessionId };
  cache.set(cacheKey, { value, expires: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(value);
}
