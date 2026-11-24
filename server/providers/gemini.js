import { postJson } from "./http.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Normalized contract: call(body, apiKey) -> { text, model }
// body (already validated): { model, system?, messages: [{role, content}], max_tokens }
export async function call(body, apiKey) {
  const { model, system, messages, max_tokens } = body;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents,
    generationConfig: { maxOutputTokens: max_tokens },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  // The key goes in a header, not the query string, so it never ends up in
  // URL logs; the model id is encoded so it can't alter the request path.
  const data = await postJson(`${BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
    providerName: "Gemini",
    headers: { "x-goog-api-key": apiKey },
    body: payload,
  });

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");

  return { text, model: data.modelVersion || model };
}
