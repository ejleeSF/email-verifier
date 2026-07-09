import { beforeEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({
  resolveMx: vi.fn(),
  resolveTxt: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ default: dns }));

import { suggestDomain, verifyEmail } from "../lib/verify";

const NO_RECORDS = Object.assign(new Error("queryMx ENOTFOUND"), {
  code: "ENOTFOUND",
});

function mockDomain({
  mx = [] as { exchange: string; priority: number }[],
  a = [] as string[],
  spf = false,
  dmarc = null as string | null,
} = {}) {
  dns.resolveMx.mockImplementation(() =>
    mx.length ? Promise.resolve(mx) : Promise.reject(NO_RECORDS),
  );
  dns.resolve4.mockImplementation(() =>
    a.length ? Promise.resolve(a) : Promise.reject(NO_RECORDS),
  );
  dns.resolve6.mockImplementation(() => Promise.reject(NO_RECORDS));
  dns.resolveTxt.mockImplementation((name: string) => {
    if (name.startsWith("_dmarc.")) {
      return dmarc
        ? Promise.resolve([[`v=DMARC1; p=${dmarc};`]])
        : Promise.reject(NO_RECORDS);
    }
    return spf
      ? Promise.resolve([["v=spf1 include:example.com ~all"]])
      : Promise.reject(NO_RECORDS);
  });
}

const MX = [{ exchange: "mx1.example.com", priority: 10 }];

beforeEach(() => {
  vi.resetAllMocks();
});

describe("verifyEmail", () => {
  it("rejects malformed addresses without touching DNS", async () => {
    const result = await verifyEmail("not-an-email");
    expect(result.verdict).toBe("undeliverable");
    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(1);
    expect(dns.resolveMx).not.toHaveBeenCalled();
  });

  it("scores a healthy personal address on a well-configured domain at 95", async () => {
    mockDomain({ mx: MX, spf: true, dmarc: "reject" });
    const result = await verifyEmail("jane.doe@gmail.com");
    expect(result.verdict).toBe("deliverable");
    expect(result.score).toBe(95);
    expect(result.suggestion).toBeNull();
    const auth = result.checks.find((c) => c.id === "auth");
    expect(auth?.status).toBe("pass");
    expect(auth?.detail).toContain("policy: reject");
  });

  it("marks domains with no mail servers undeliverable", async () => {
    mockDomain();
    const result = await verifyEmail("foo@no-such-domain.example");
    expect(result.verdict).toBe("undeliverable");
    expect(result.score).toBe(5);
    expect(result.checks.find((c) => c.id === "mx")?.status).toBe("fail");
  });

  it("treats a null MX record (RFC 7505) as no mail servers", async () => {
    mockDomain({ mx: [{ exchange: ".", priority: 0 }], a: ["1.2.3.4"] });
    const result = await verifyEmail("foo@refuses-mail.example");
    expect(result.verdict).toBe("undeliverable");
    expect(result.score).toBe(5);
  });

  it("falls back to A records with a warning when MX is missing", async () => {
    mockDomain({ a: ["1.2.3.4"] });
    const result = await verifyEmail("foo@a-only.example");
    expect(result.checks.find((c) => c.id === "mx")?.status).toBe("warn");
    expect(result.verdict).toBe("risky");
    expect(result.score).toBe(50); // 95 - 35 (a-only) - 10 (no SPF/DMARC)
  });

  it("flags disposable domains as risky", async () => {
    mockDomain({ mx: MX, spf: true, dmarc: "none" });
    const result = await verifyEmail("throwaway@mailinator.com");
    expect(result.verdict).toBe("risky");
    expect(result.checks.find((c) => c.id === "disposable")?.status).toBe(
      "fail",
    );
  });

  it("suggests a fix for typo'd provider domains", async () => {
    mockDomain({ mx: MX });
    const result = await verifyEmail("Jane@GMIAL.com");
    expect(result.email).toBe("jane@gmial.com");
    expect(result.suggestion).toBe("jane@gmail.com");
    expect(result.checks.find((c) => c.id === "typo")?.status).toBe("warn");
  });

  it("warns on role accounts and deducts from the score", async () => {
    mockDomain({ mx: MX, spf: true, dmarc: "quarantine" });
    const result = await verifyEmail("noreply@example.com");
    expect(result.checks.find((c) => c.id === "role")?.status).toBe("warn");
    expect(result.score).toBe(85);
  });

  it("deducts more when a domain publishes neither SPF nor DMARC", async () => {
    mockDomain({ mx: MX });
    const withNeither = await verifyEmail("jane@example.com");
    mockDomain({ mx: MX, spf: true });
    const withSpfOnly = await verifyEmail("jane@example.com");
    expect(withNeither.score).toBe(85);
    expect(withSpfOnly.score).toBe(90);
  });
});

describe("suggestDomain", () => {
  it("suggests close misspellings of popular providers", () => {
    expect(suggestDomain("gmial.com")).toBe("gmail.com");
    expect(suggestDomain("yaho.com")).toBe("yahoo.com");
    expect(suggestDomain("outlok.com")).toBe("outlook.com");
  });

  it("leaves correct and unrelated domains alone", () => {
    expect(suggestDomain("gmail.com")).toBeNull();
    expect(suggestDomain("canarytechnologies.com")).toBeNull();
  });
});
