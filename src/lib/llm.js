export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
  { id: "claude-opus-5", label: "Opus 5 — most precise" },
];

// modelInput: "select" (curated list above) or "text" (provider names change often
// enough — GPT/Gemini/DeepSeek model IDs — that we don't hardcode and risk a stale guess).
export const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", modelInput: "select" },
  { id: "openai", label: "OpenAI (GPT)", modelInput: "text", placeholder: "e.g. gpt-5.1" },
  { id: "gemini", label: "Google Gemini", modelInput: "text", placeholder: "e.g. gemini-3-pro" },
  { id: "deepseek", label: "DeepSeek", modelInput: "text", placeholder: "e.g. deepseek-chat" },
  {
    id: "custom",
    label: "Custom / self-hosted",
    modelInput: "text",
    placeholder: "model id served by your endpoint",
    needsBaseUrl: true,
    needsApiKey: true,
  },
];

export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-sonnet-5";

function extractText(data) {
  return (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function callLlm(userText, systemText, llmConfig) {
  const { provider, model, baseUrl, apiKey } = llmConfig;

  const body = {
    provider,
    model,
    max_tokens: 1000,
    messages: [{ role: "user", content: userText }],
  };
  if (systemText) body.system = systemText;
  if (provider === "custom") {
    body.baseUrl = baseUrl;
    if (apiKey) body.apiKey = apiKey;
  }

  const res = await fetch("/api/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  // Anthropic-shaped responses still arrive as content blocks if a provider adapter
  // ever forwards raw output; every current adapter already normalizes to {text, model}.
  return { text: data.text ?? extractText(data), model: data.model };
}

export async function gradeOutput(rubric, promptUsed, output, llmConfig) {
  const { text: grading } = await callLlm(
    `Rubric:\n${rubric}\n\nPrompt sent to the model:\n${promptUsed}\n\nModel's response:\n${output}\n\nScore the response from 1-10 against the rubric. Respond ONLY with JSON, no markdown fences, in this exact shape: {"score": <number 1-10>, "reasoning": "<one or two sentences>"}`,
    undefined,
    llmConfig
  );

  try {
    const clean = grading.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { score: null, reasoning: "Could not parse grading response." };
  }
}

export async function runPrompt(promptText, llmConfig) {
  return callLlm(promptText, undefined, llmConfig);
}
