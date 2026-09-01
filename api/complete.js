import { providerConfigFromEnv, resolveCompletion } from "../server/complete.js";

const getProviderConfig = (provider) =>
  providerConfigFromEnv(provider, (key) => process.env[key]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const data = await resolveCompletion(req.body || {}, getProviderConfig);
    res.status(200).json(data);
  } catch (err) {
    const status = err.status || 502;
    res.status(status).json({ error: err.message || "Request failed." });
  }
}
