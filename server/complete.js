import * as anthropic from "./providers/anthropic.js";
import * as gemini from "./providers/gemini.js";
import * as openaiCompatible from "./providers/openaiCompatible.js";
import { HttpError } from "./errors.js";
import { validateCustomBaseUrl, validateLlmBody } from "./validate.js";

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

/**
 * Validates a /api/complete request and dispatches it to the right provider adapter.
 * Shared by the Vite dev-server middleware (server/router.js) and the Vercel
 * serverless function (api/complete.js) so the validation rules never drift.
 *
 * options.allowCustom — whether the "custom" provider is enabled. It lets the
 * client choose the URL the server fetches, which is fine on a developer's own
 * machine but would turn a public deployment into an open proxy (SSRF), so it is
 * OFF unless the caller explicitly enables it.
 */
export async function resolveCompletion(parsedBody, getProviderConfig, { allowCustom = false } = {}) {
  if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const { provider, baseUrl: clientBaseUrl, apiKey: clientApiKey, ...rest } = parsedBody;

  if (!provider) throw new HttpError(400, 'Request is missing a "provider" field.');
  if (!KNOWN_PROVIDERS.has(provider)) throw new HttpError(400, `Unknown provider "${provider}".`);

  if (provider === "custom" && !allowCustom) {
    throw new HttpError(403, "The custom provider is only available when running the app locally.");
  }

  const llmBody = validateLlmBody(rest, provider);

  let config;
  if (provider === "custom") {
    if (clientApiKey !== undefined && typeof clientApiKey !== "string") {
      throw new HttpError(400, "apiKey must be a string.");
    }
    config = { apiKey: clientApiKey || "", baseUrl: validateCustomBaseUrl(clientBaseUrl) };
  } else {
    config = getProviderConfig(provider);
    if (!config.apiKey) throw new HttpError(500, `No API key configured for "${provider}".`);
  }

  return callProvider(provider, llmBody, config);
}
