// Shared adapter for any OpenAI-compatible Chat Completions endpoint —
// OpenAI itself, DeepSeek, and self-hosted/personal servers (Ollama, vLLM, LM Studio, ...).
//
// Normalized contract: call(body, apiKey, baseUrl) -> { text, model }
// body: { model, system?, messages: [{role, content}], max_tokens }
export async function call(body, apiKey, baseUrl) {
  const { system, messages, ...rest } = body;

  const chatMessages = system ? [{ role: "system", content: system }, ...messages] : messages;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ ...rest, messages: chatMessages }),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error?.message || `API error (${res.status})`);
    error.status = res.status;
    throw error;
  }

  const text = data.choices?.[0]?.message?.content || "";

  return { text, model: data.model || body.model };
}
