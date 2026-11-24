import { resolveCompletion } from "./complete.js";
import { HttpError } from "./errors.js";
import { LIMITS } from "./validate.js";

// Reads the request body, refusing anything larger than LIMITS.maxBodyBytes.
function readRequestBody(req, maxBytes = LIMITS.maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, "Request body is too large."));
        req.destroy();
        return;
      }
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

// Vite dev/preview middleware. It only ever runs on the developer's own machine,
// so the "custom" provider (pointing at a local Ollama, vLLM, ...) is enabled here.
// getProviderConfig(provider) -> { apiKey, baseUrl? } sourced from server env.
export function createLlmMiddleware(getProviderConfig, { allowCustom = true } = {}) {
  return async (req, res, next) => {
    if (req.url !== "/api/complete" || req.method !== "POST") {
      return next();
    }

    try {
      const raw = await readRequestBody(req);
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        throw new HttpError(400, "Request body is not valid JSON.");
      }
      const data = await resolveCompletion(parsed, getProviderConfig, { allowCustom });
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, err.status || 500, { error: err.status ? err.message : "Request failed." });
    }
  };
}
