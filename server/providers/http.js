import { HttpError } from "../errors.js";

export const REQUEST_TIMEOUT_MS = 60_000;

// POST JSON to a provider with a timeout, and turn any failure into an HttpError.
// Upstream failures are reported as 502 (bad gateway): the client's request was fine,
// the provider wasn't. The provider's own message is kept because it's useful
// ("model not found", "quota exceeded"), but its status code is not passed through.
export async function postJson(url, { headers = {}, body, providerName }) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError") {
      throw new HttpError(504, `${providerName} did not respond in time.`);
    }
    throw new HttpError(502, `Could not reach ${providerName}.`);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || `${providerName} API error (${res.status})`;
    throw new HttpError(502, message);
  }
  if (data === null) throw new HttpError(502, `${providerName} returned an invalid response.`);

  return data;
}
