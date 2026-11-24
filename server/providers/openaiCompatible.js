import { postJson } from "./http.js";

// Shared adapter for any OpenAI-compatible Chat Completions endpoint —
// OpenAI itself, DeepSeek, and self-hosted/personal servers (Ollama, vLLM, LM Studio, ...).
//
// Normalized contract: call(body, apiKey, baseUrl) -> { text, model }
// body (already validated): { model, system?, messages: [{role, content}], max_tokens }
export async function call(body, apiKey, baseUrl) {
  const { model, system, messages, max_tokens } = body;

  const chatMessages = system ? [{ role: "system", content: system }, ...messages] : messages;

  const data = await postJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    providerName: "The model provider",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    // Only explicitly known fields are forwarded — never the raw client body.
    body: { model, max_tokens, messages: chatMessages },
  });

  const text = data.choices?.[0]?.message?.content || "";

  return { text, model: data.model || model };
}
