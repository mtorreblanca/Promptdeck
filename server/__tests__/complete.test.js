import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCompletion } from "../complete.js";

const body = {
  provider: "openai",
  model: "gpt-5.1",
  max_tokens: 100,
  messages: [{ role: "user", content: "Hi" }],
};
const keys = () => ({ apiKey: "server-key" });

function mockFetch(json = { choices: [{ message: { content: "ok" } }], model: "gpt-5.1" }) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(json), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveCompletion", () => {
  it("dispatches a valid request and returns normalized output", async () => {
    mockFetch();
    await expect(resolveCompletion(body, keys)).resolves.toEqual({ text: "ok", model: "gpt-5.1" });
  });

  it("rejects missing and unknown providers", async () => {
    await expect(resolveCompletion({ ...body, provider: undefined }, keys)).rejects.toMatchObject({ status: 400 });
    await expect(resolveCompletion({ ...body, provider: "evil" }, keys)).rejects.toMatchObject({ status: 400 });
  });

  it("blocks the custom provider unless explicitly allowed (SSRF guard)", async () => {
    const fetchMock = mockFetch();
    const custom = { ...body, provider: "custom", baseUrl: "http://169.254.169.254/latest" };
    await expect(resolveCompletion(custom, keys)).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows the custom provider locally and validates its URL", async () => {
    const fetchMock = mockFetch();
    const custom = { ...body, provider: "custom", baseUrl: "http://localhost:11434/v1" };
    await resolveCompletion(custom, keys, { allowCustom: true });
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/v1/chat/completions");

    await expect(
      resolveCompletion({ ...custom, baseUrl: "file:///etc/passwd" }, keys, { allowCustom: true })
    ).rejects.toMatchObject({ status: 400 });
  });

  it("never forwards fields the client sneaks in", async () => {
    const fetchMock = mockFetch();
    await resolveCompletion({ ...body, tools: [{ type: "function" }], n: 50, stream: true }, keys);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(sent).sort()).toEqual(["max_tokens", "messages", "model"]);
  });

  it("returns 500 when the server has no key for the provider", async () => {
    await expect(resolveCompletion(body, () => ({}))).rejects.toMatchObject({ status: 500 });
  });

  it("reports provider failures as 502 with the provider's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }))
    );
    await expect(resolveCompletion(body, keys)).rejects.toMatchObject({ status: 502, message: "model not found" });
  });
});
