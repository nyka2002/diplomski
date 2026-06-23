// Translate a scraped (Croatian) listing's text into English at ingest time,
// using the same OpenAI key as embeddings. Returns the English fields, or null
// when OpenAI isn't configured / the call fails — ingestion must not depend on
// it (listings stay Croatian in both languages until a later run translates).
//
// Proper nouns (place names, neighbourhoods, person/agency names) are NOT sent
// here and are kept as-is; only the title, description, and spec rows (label +
// value) are translated.
import { env } from "./env.mjs";

const MODEL = "gpt-4o-mini";

export async function translateListing({ title, description, specs }) {
  if (!env.openaiKey) return null;

  const payload = {
    title: title || "",
    description: description || "",
    specs: (specs || []).map((s) => ({ label: s.labelHr ?? s.label, value: s.valueHr ?? s.value })),
  };

  const system =
    "You are a professional Croatian→English translator for real-estate listings. " +
    "Translate the title, description, and each spec's label and value into natural English. " +
    "Keep proper nouns (city/neighbourhood names, person and agency names) unchanged. " +
    "Keep numbers, measurements and units (m², €), energy classes, and codes exactly as-is. " +
    "Return ONLY JSON of the shape " +
    '{"title":string,"description":string,"specs":[{"label":string,"value":string}]} ' +
    "with the specs in the SAME ORDER as the input.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const en = JSON.parse(content);
    if (typeof en.title !== "string" || typeof en.description !== "string") return null;
    return {
      title: en.title.trim() || title,
      description: en.description.trim() || description,
      specs: Array.isArray(en.specs) ? en.specs : [],
    };
  } catch {
    return null;
  }
}
