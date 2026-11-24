import { postJson } from "./http.js";

const URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

// Normalized contract: call(body, apiKey) -> { text, model }
// body (already validated): { model, system?, messages: [{role, content}], max_tokens }
export async function call(body, apiKey) {
  const { model, system, messages, max_tokens } = body;

  const data = await postJson(URL, {
    providerName: "Anthropic",
    headers: { "x-api-key": apiKey, "anthropic-version": VERSION },
    body: { model, messages, max_tokens, ...(system ? { system } : {}) },
  });

  const text = (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");

  return { text, model: data.model };
}
