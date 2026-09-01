import * as anthropic from "./providers/anthropic.js";
import * as gemini from "./providers/gemini.js";
import * as openaiCompatible from "./providers/openaiCompatible.js";

const NAMED_PROVIDER_DEFAULTS = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
};

const KNOWN_PROVIDERS = new Set(["anthropic", "openai", "gemini", "deepseek", "custom"]);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
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
export function createLlmMiddleware(getProviderConfig) {
  return async (req, res, next) => {
    if (req.url !== "/api/complete" || req.method !== "POST") {
      return next();
    }

    try {
      const raw = await readRequestBody(req);
      const parsed = raw ? JSON.parse(raw) : {};
      const { provider, baseUrl: clientBaseUrl, apiKey: clientApiKey, ...llmBody } = parsed;

      if (!provider) {
        const error = new Error("Request is missing a \"provider\" field.");
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
        const error = new Error(
          `No API key configured for "${provider}". Add it to .env and restart the dev server.`
        );
        error.status = 500;
        throw error;
      }

      const data = await callProvider(provider, llmBody, config);
      sendJson(res, 200, data);
    } catch (err) {
      const status = err.status || (err instanceof SyntaxError ? 400 : 502);
      sendJson(res, status, { error: err.message || "Request failed." });
    }
  };
}
