import { ANTHROPIC_MODEL_IDS } from "../shared/models.js";
import { HttpError } from "./errors.js";

// Hard caps on what a single request may ask for. They bound both cost
// (tokens billed to the server's API keys) and abuse (huge payloads).
export const LIMITS = Object.freeze({
  maxTokens: 2000,
  maxMessages: 20,
  maxContentChars: 20_000,
  maxSystemChars: 10_000,
  maxBodyBytes: 100_000,
});

const ROLES = new Set(["user", "assistant"]);

// Model IDs across providers use letters, digits and . _ : - (and "/" for some
// self-hosted servers, e.g. "meta-llama/Llama-3.1-8B"). Nothing else is allowed,
// so a model ID can never smuggle a path segment or query string into a URL.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates the LLM part of a request and returns a sanitized copy that contains
 * ONLY the fields the adapters understand. Unknown fields (tools, n, stream, ...)
 * are dropped, so clients can't use the server's keys for anything but a plain completion.
 */
export function validateLlmBody(body, provider) {
  if (!isPlainObject(body)) throw new HttpError(400, "Request body must be a JSON object.");

  const { model, system, messages, max_tokens: maxTokens } = body;

  if (typeof model !== "string" || !MODEL_ID.test(model)) {
    throw new HttpError(400, "Invalid or missing model id.");
  }
  if (provider === "anthropic" && !ANTHROPIC_MODEL_IDS.has(model)) {
    throw new HttpError(400, `Model "${model}" is not offered for Anthropic.`);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, "messages must be a non-empty array.");
  }
  if (messages.length > LIMITS.maxMessages) {
    throw new HttpError(400, `Too many messages (max ${LIMITS.maxMessages}).`);
  }
  const cleanMessages = messages.map((m, i) => {
    if (!isPlainObject(m) || !ROLES.has(m.role) || typeof m.content !== "string") {
      throw new HttpError(400, `messages[${i}] must be { role: "user" | "assistant", content: string }.`);
    }
    if (m.content.length > LIMITS.maxContentChars) {
      throw new HttpError(400, `messages[${i}] is too long (max ${LIMITS.maxContentChars} characters).`);
    }
    return { role: m.role, content: m.content };
  });

  if (system !== undefined) {
    if (typeof system !== "string") throw new HttpError(400, "system must be a string.");
    if (system.length > LIMITS.maxSystemChars) {
      throw new HttpError(400, `system is too long (max ${LIMITS.maxSystemChars} characters).`);
    }
  }

  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > LIMITS.maxTokens) {
    throw new HttpError(400, `max_tokens must be an integer between 1 and ${LIMITS.maxTokens}.`);
  }

  return {
    model,
    messages: cleanMessages,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
  };
}

/**
 * Validates the base URL a client supplies for the "custom" provider.
 * Only plain http(s) URLs without embedded credentials are accepted.
 */
export function validateCustomBaseUrl(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new HttpError(400, "Custom provider requires a baseUrl.");
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "baseUrl is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "baseUrl must use http or https.");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "baseUrl must not contain credentials.");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
