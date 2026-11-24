import { afterEach, describe, expect, it, vi } from "vitest";

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (payload) => ((res.body = payload), res);
  res.setHeader = (k, v) => (res.headers[k] = v);
  return res;
}

async function loadHandler(env = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("./complete.js")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("api/complete handler", () => {
  it("rejects non-POST requests", async () => {
    const handler = await loadHandler();
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("rate-limits a single client", async () => {
    const handler = await loadHandler({ RATE_LIMIT_PER_MINUTE: "1" });
    const req = { method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: {} };
    await handler(req, mockRes()); // first request (fails validation, still counts)
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBeDefined();
  });

  it("rejects the custom provider in production by default", async () => {
    const handler = await loadHandler();
    const res = mockRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          provider: "custom",
          baseUrl: "http://169.254.169.254",
          model: "x",
          max_tokens: 10,
          messages: [{ role: "user", content: "hi" }],
        },
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it("rejects oversized bodies", async () => {
    const handler = await loadHandler();
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { junk: "x".repeat(200_000) } }, res);
    expect(res.statusCode).toBe(413);
  });
});
