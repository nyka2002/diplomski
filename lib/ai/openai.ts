import "server-only";
import type { LocationGroup } from "@/lib/listings/types";
import type { Lang } from "@/lib/i18n/translations";
import { AiCriteria, CRITERIA_JSON_SCHEMA, buildSystemPrompt, parseCriteria } from "./criteria";

// ── Model configuration (phase 10) ───────────────────────────────────────────
// The default path is unchanged: OpenAI, gpt-4o-mini, text-embedding-3-small.
// To compare other providers/models (e.g. open models via an OpenAI-compatible
// gateway like OpenRouter) set OPENAI_BASE_URL + AI_API_KEY + AI_CHAT_MODEL /
// AI_EMBED_MODEL, or pass per-call overrides (used by the offline model
// comparison in the evaluation phase). NOTE: changing AI_EMBED_MODEL to a model
// with a different vector dimension would not match the production
// vector(1536) column — embedding comparison is meant to run offline.
const KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
export const CHAT_MODEL = process.env.AI_CHAT_MODEL || "gpt-4o-mini";
export const EMBED_MODEL = process.env.AI_EMBED_MODEL || "text-embedding-3-small";

export const isOpenAIConfigured = Boolean(KEY);

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// How the model is asked to return JSON. "schema" = OpenAI strict structured
// output (default, most reliable); "object" = the looser json_object mode some
// gateways support; "none" = no format hint (rely on parseCriteria recovery).
export type JsonMode = "schema" | "object" | "none";

export interface ModelOverrides {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  jsonMode?: JsonMode;
}

// Which models support OpenAI strict structured outputs (json_schema). The
// default gpt-4o-mini and the gpt-4o / gpt-4.1 / o-series / gpt-5 families do;
// older ones (e.g. gpt-3.5-turbo) only support json_object, so they fall back to
// the lenient parse (parseCriteria) instead. Lets a model be swapped in without
// hitting a 400 for an unsupported response_format.
export function supportsSchema(model: string): boolean {
  return /^(gpt-4o|gpt-4\.1|gpt-5|o[134])/.test(model);
}

function responseFormat(mode: JsonMode) {
  if (mode === "schema")
    return {
      response_format: {
        type: "json_schema",
        json_schema: { name: "search_criteria", strict: true, schema: CRITERIA_JSON_SCHEMA },
      },
    };
  if (mode === "object") return { response_format: { type: "json_object" } };
  return {};
}

// Turn the conversation into structured search criteria. Returns null when no
// API key is configured. Output is parsed leniently (parseCriteria) so it
// tolerates non-OpenAI models that wrap or slightly malform the JSON; the
// default OpenAI strict path is unaffected (its output validates as-is).
export async function extractCriteria(
  messages: ChatMessage[],
  locations: LocationGroup[],
  lang: Lang,
  overrides: ModelOverrides = {},
): Promise<AiCriteria | null> {
  const apiKey = overrides.apiKey ?? KEY;
  if (!apiKey) return null;
  const baseUrl = (overrides.baseUrl ?? BASE_URL).replace(/\/+$/, "");
  const model = overrides.model ?? CHAT_MODEL;
  // Default json mode follows the model's capability (schema when supported,
  // else json_object); an explicit override still wins.
  const jsonMode = overrides.jsonMode ?? (supportsSchema(model) ? "schema" : "object");

  // json_object mode requires the word "json" to appear in the prompt, and open
  // models benefit from an explicit "return one JSON object" instruction. The
  // default (schema) path is unchanged.
  let system = buildSystemPrompt(locations, lang);
  if (jsonMode !== "schema") system += "\n\nReturn a single JSON object with exactly the described fields.";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: "system", content: system }, ...messages],
      ...responseFormat(jsonMode),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`chat ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("chat returned no content");
  const parsed = parseCriteria(content);
  if (!parsed) throw new Error("could not parse criteria from model output");
  return parsed;
}

// Embed text for semantic ranking. Returns null if unconfigured or on error.
export async function embedText(text: string, overrides: ModelOverrides = {}): Promise<number[] | null> {
  const apiKey = overrides.apiKey ?? KEY;
  if (!apiKey || !text.trim()) return null;
  const baseUrl = (overrides.baseUrl ?? BASE_URL).replace(/\/+$/, "");
  const model = overrides.model ?? EMBED_MODEL;
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}
