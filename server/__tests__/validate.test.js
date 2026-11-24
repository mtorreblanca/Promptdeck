import { describe, expect, it } from "vitest";
import { LIMITS, validateCustomBaseUrl, validateLlmBody } from "../validate.js";

const valid = {
  model: "claude-sonnet-5",
  max_tokens: 1000,
  messages: [{ role: "user", content: "Hello" }],
};

describe("validateLlmBody", () => {
  it("returns only the known fields and drops everything else", () => {
    const out = validateLlmBody({ ...valid, tools: [{}], stream: true, n: 5 }, "anthropic");
    expect(out).toEqual(valid);
  });

  it("keeps a system prompt when present", () => {
    expect(validateLlmBody({ ...valid, system: "Be brief." }, "anthropic").system).toBe("Be brief.");
  });

  it("rejects Anthropic models that are not offered in the app", () => {
    expect(() => validateLlmBody({ ...valid, model: "claude-unknown" }, "anthropic")).toThrow(/not offered/);
  });

  it.each(["../../admin", "gemini?key=x", "model#frag", "", " "])(
    "rejects an unsafe model id: %j",
    (model) => {
      expect(() => validateLlmBody({ ...valid, model }, "gemini")).toThrow(/model id/);
    }
  );

  it("accepts model ids with slashes for self-hosted servers", () => {
    expect(validateLlmBody({ ...valid, model: "meta-llama/Llama-3.1-8B" }, "custom").model).toBe(
      "meta-llama/Llama-3.1-8B"
    );
  });

  it.each([0, -1, 1.5, LIMITS.maxTokens + 1, "1000", undefined])("rejects max_tokens = %j", (max_tokens) => {
    expect(() => validateLlmBody({ ...valid, max_tokens }, "anthropic")).toThrow(/max_tokens/);
  });

  it("rejects empty, oversized or malformed message lists", () => {
    expect(() => validateLlmBody({ ...valid, messages: [] }, "openai")).toThrow(/non-empty/);
    const many = Array.from({ length: LIMITS.maxMessages + 1 }, () => ({ role: "user", content: "x" }));
    expect(() => validateLlmBody({ ...valid, messages: many }, "openai")).toThrow(/Too many/);
    expect(() => validateLlmBody({ ...valid, messages: [{ role: "system", content: "x" }] }, "openai")).toThrow();
    const huge = [{ role: "user", content: "x".repeat(LIMITS.maxContentChars + 1) }];
    expect(() => validateLlmBody({ ...valid, messages: huge }, "openai")).toThrow(/too long/);
  });

  it("errors carry a 400 status", () => {
    try {
      validateLlmBody({}, "openai");
    } catch (err) {
      expect(err.status).toBe(400);
    }
  });
});

describe("validateCustomBaseUrl", () => {
  it("normalizes a valid http(s) URL", () => {
    expect(validateCustomBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1");
    expect(validateCustomBaseUrl("https://example.com/v1?x=1#y")).toBe("https://example.com/v1");
  });

  it.each(["", "not a url", "file:///etc/passwd", "ftp://example.com", "https://user:pass@example.com"])(
    "rejects %j",
    (url) => {
      expect(() => validateCustomBaseUrl(url)).toThrow();
    }
  );
});
