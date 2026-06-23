import "server-only";
import type { LocationGroup } from "@/lib/listings/types";
import type { Lang } from "@/lib/i18n/translations";
import { AiCriteria, CRITERIA_JSON_SCHEMA, buildSystemPrompt } from "./criteria";

const KEY = process.env.OPENAI_API_KEY;
export const isOpenAIConfigured = Boolean(KEY);

const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Turn the conversation into structured search criteria via GPT-4o mini's
// strict JSON-schema output. Returns null when no API key is configured.
export async function extractCriteria(
  messages: ChatMessage[],
  locations: LocationGroup[],
  lang: Lang,
): Promise<AiCriteria | null> {
  if (!KEY) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.1,
      messages: [{ role: "system", content: buildSystemPrompt(locations, lang) }, ...messages],
      response_format: {
        type: "json_schema",
        json_schema: { name: "search_criteria", strict: true, schema: CRITERIA_JSON_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI chat ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI chat returned no content");
  return JSON.parse(content) as AiCriteria;
}

// Embed text for semantic ranking. Returns null if unconfigured or on error.
export async function embedText(text: string): Promise<number[] | null> {
  if (!KEY || !text.trim()) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding;
  return Array.isArray(embedding) ? embedding : null;
}
