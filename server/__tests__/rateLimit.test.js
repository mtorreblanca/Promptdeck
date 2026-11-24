import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "../rateLimit.js";

describe("createRateLimiter", () => {
  it("allows up to max requests per window, then blocks with a retry hint", () => {
    let t = 0;
    const check = createRateLimiter({ windowMs: 60_000, max: 2, now: () => t });
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    const blocked = check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
    expect(check("b").allowed).toBe(true); // other clients are unaffected

    t = 60_000; // window resets
    expect(check("a").allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(clientKey({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientKey({ "x-real-ip": "5.6.7.8" })).toBe("5.6.7.8");
    expect(clientKey({})).toBe("unknown");
  });
});
