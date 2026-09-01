const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Normalized contract: call(body, apiKey) -> { text, model }
// body: { model, system?, messages: [{role, content}], max_tokens }
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

  const res = await fetch(`${BASE_URL}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error?.message || `Gemini API error (${res.status})`);
    error.status = res.status;
    throw error;
  }

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");

  return { text, model: data.modelVersion || model };
}
