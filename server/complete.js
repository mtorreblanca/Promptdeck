import * as anthropic from "./providers/anthropic.js";
import * as gemini from "./providers/gemini.js";
import * as openaiCompatible from "./providers/openaiCompatible.js";

const NAMED_PROVIDER_DEFAULTS = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
};

const KNOWN_PROVIDERS = new Set(["anthropic", "openai", "gemini", "deepseek", "custom"]);

// read(key) -> env var value. Shared by the Vite dev-server plugin (which reads via
// Vite's loadEnv) and the Vercel serverless function (which reads process.env directly).
export function providerConfigFromEnv(provider, read) {
  switch (provider) {
    case "anthropic":
      return { apiKey: read("ANTHROPIC_API_KEY") };
    case "openai":
      return { apiKey: read("OPENAI_API_KEY"), baseUrl: read("OPENAI_BASE_URL") };
    case "gemini":
      return { apiKey: read("GEMINI_API_KEY") };
    case "deepseek":
      return { apiKey: read("DEEPSEEK_API_KEY"), baseUrl: read("DEEPSEEK_BASE_URL") };
    default:
      return {};
  }
}

async function callProvider(provider, llmBody, config) {
  switch (provider) {
    case "anthropic":
      return anthropic.call(llmBody, config.apiKey);
    case "gemini":
      return gemini.call(llmBody, config.apiKey);
    case "openai":
    case "deepseek":
      return openaiCompatible.call(
        llmBody,
        config.apiKey,
        config.baseUrl || NAMED_PROVIDER_DEFAULTS[provider]
      );
    case "custom":
      return openaiCompatible.call(llmBody, config.apiKey, config.baseUrl);
  }
}

// getProviderConfig(provider) -> { apiKey, baseUrl? } sourced from server env,
// used for every named provider (anthropic/openai/gemini/deepseek).
// Shared by the Vite dev-server middleware (server/router.js) and the Vercel
// serverless function (api/complete.js) so the validation rules never drift.
export async function resolveCompletion(parsedBody, getProviderConfig) {
  const { provider, baseUrl: clientBaseUrl, apiKey: clientApiKey, ...llmBody } = parsedBody;

  if (!provider) {
    const error = new Error('Request is missing a "provider" field.');
    error.status = 400;
    throw error;
  }

  if (!KNOWN_PROVIDERS.has(provider)) {
    const error = new Error(`Unknown provider "${provider}".`);
    error.status = 400;
    throw error;
  }

  // "custom" targets a self-hosted/personal endpoint the client supplies directly —
  // there is no server-side secret to protect for a local, unauthenticated model server.
  const config =
    provider === "custom"
      ? { apiKey: clientApiKey || "", baseUrl: clientBaseUrl }
      : getProviderConfig(provider);

  if (provider === "custom" && !config.baseUrl) {
    const error = new Error("Custom provider requires a baseUrl.");
    error.status = 400;
    throw error;
  }

  if (provider !== "custom" && !config.apiKey) {
    const error = new Error(`No API key configured for "${provider}".`);
    error.status = 500;
    throw error;
  }

  return callProvider(provider, llmBody, config);
}
