// Single source of truth for the curated Anthropic model list.
// Imported by the UI (model picker) and by the server (request validation),
// so the allowlist can never drift from what the app actually offers.
export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — balanced" },
  { id: "claude-opus-5", label: "Opus 5 — most precise" },
];

export const ANTHROPIC_MODEL_IDS = new Set(ANTHROPIC_MODELS.map((m) => m.id));
