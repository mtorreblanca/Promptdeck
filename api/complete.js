import { providerConfigFromEnv, resolveCompletion } from "../server/complete.js";
import { clientKey, createRateLimiter } from "../server/rateLimit.js";
import { LIMITS } from "../server/validate.js";

const getProviderConfig = (provider) =>
  providerConfigFromEnv(provider, (key) => process.env[key]);

// Best-effort per-IP limit (see server/rateLimit.js). Configurable per deployment.
const perMinute = Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "10", 10);
const checkRate = createRateLimiter({ windowMs: 60_000, max: perMinute > 0 ? perMinute : 10 });

// The custom provider makes the server fetch a client-chosen URL. That's an SSRF risk
// on a public deployment, so it stays off unless explicitly enabled.
const allowCustom = process.env.ALLOW_CUSTOM_PROVIDER === "true";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const rate = checkRate(clientKey(req.headers));
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    return;
  }

  const body = req.body ?? {};
  if (JSON.stringify(body).length > LIMITS.maxBodyBytes) {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }

  try {
    const data = await resolveCompletion(body, getProviderConfig, { allowCustom });
    res.status(200).json(data);
  } catch (err) {
    // Only errors we raised on purpose carry a status; anything else is unexpected,
    // so don't echo its internal message back to the client.
    res.status(err.status || 500).json({ error: err.status ? err.message : "Request failed." });
  }
}
