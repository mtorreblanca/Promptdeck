import { afterEach, describe, expect, it, vi } from "vitest";
import * as gemini from "../providers/gemini.js";

afterEach(() => vi.unstubAllGlobals());

describe("gemini adapter", () => {
  it("sends the API key in a header (not the URL) and encodes the model id", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hi" }] } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await gemini.call(
      { model: "gemini-3-pro", max_tokens: 50, messages: [{ role: "user", content: "x" }] },
      "secret-key"
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent");
    expect(url).not.toContain("secret-key");
    expect(init.headers["x-goog-api-key"]).toBe("secret-key");
    expect(init.signal).toBeDefined(); // request has a timeout
    expect(out.text).toBe("hi");
  });
});
