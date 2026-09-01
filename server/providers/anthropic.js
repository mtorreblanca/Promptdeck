const URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

// Normalized contract: call(body, apiKey) -> { text, model }
// body: { model, system?, messages: [{role, content}], max_tokens }
export async function call(body, apiKey) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": VERSION,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error?.message || `Anthropic API error (${res.status})`);
    error.status = res.status;
    throw error;
  }

  const text = (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");

  return { text, model: data.model };
}
