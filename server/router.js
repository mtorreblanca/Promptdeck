import { resolveCompletion } from "./complete.js";

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

// getProviderConfig(provider) -> { apiKey, baseUrl? } sourced from server env.
export function createLlmMiddleware(getProviderConfig) {
  return async (req, res, next) => {
    if (req.url !== "/api/complete" || req.method !== "POST") {
      return next();
    }

    try {
      const raw = await readRequestBody(req);
      const parsed = raw ? JSON.parse(raw) : {};
      const data = await resolveCompletion(parsed, getProviderConfig);
      sendJson(res, 200, data);
    } catch (err) {
      const status = err.status || (err instanceof SyntaxError ? 400 : 502);
      sendJson(res, status, { error: err.message || "Request failed." });
    }
  };
}
