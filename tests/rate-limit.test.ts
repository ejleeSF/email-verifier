import { describe, expect, it } from "vitest";

import { rateLimit } from "../lib/rate-limit";

const T0 = 1_700_000_000_000;

describe("rateLimit", () => {
  it("allows up to 20 requests per minute per key", () => {
    for (let i = 0; i < 20; i++) {
      expect(rateLimit("ip-a", T0 + i * 100).allowed).toBe(true);
    }
    expect(rateLimit("ip-a", T0 + 3000).allowed).toBe(false);
  });

  it("tells blocked callers when to retry", () => {
    for (let i = 0; i < 20; i++) rateLimit("ip-b", T0);
    const blocked = rateLimit("ip-b", T0 + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it("frees the window as old requests age out", () => {
    for (let i = 0; i < 20; i++) rateLimit("ip-c", T0);
    expect(rateLimit("ip-c", T0 + 30_000).allowed).toBe(false);
    expect(rateLimit("ip-c", T0 + 61_000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    for (let i = 0; i < 20; i++) rateLimit("ip-d", T0);
    expect(rateLimit("ip-d", T0).allowed).toBe(false);
    expect(rateLimit("ip-e", T0).allowed).toBe(true);
  });
});
