import dns from "node:dns/promises";
import isEmail from "validator/lib/isEmail";
import disposableDomains from "disposable-email-domains";

export type CheckStatus = "pass" | "warn" | "fail" | "info" | "skip";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export type Verdict = "deliverable" | "risky" | "undeliverable";

export interface VerifyResult {
  email: string;
  verdict: Verdict;
  score: number; // 0-100 confidence that mail to this address would be delivered
  suggestion: string | null; // "did you mean" corrected address
  checks: Check[];
}

const DISPOSABLE = new Set<string>(disposableDomains);

const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
  "comcast.net",
  "me.com",
  "mail.com",
  "gmx.com",
  "zoho.com",
];

const FREE_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "icloud.com",
  "me.com",
  "aol.com",
  "live.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
]);

const ROLE_ACCOUNTS = new Set([
  "admin",
  "administrator",
  "info",
  "support",
  "sales",
  "contact",
  "help",
  "hello",
  "team",
  "office",
  "billing",
  "hr",
  "careers",
  "jobs",
  "marketing",
  "press",
  "media",
  "noreply",
  "no-reply",
  "donotreply",
  "postmaster",
  "webmaster",
  "hostmaster",
  "abuse",
  "security",
  "root",
]);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return row[n];
}

function suggestDomain(domain: string): string | null {
  if (COMMON_DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestDist = 3; // only suggest for distance 1-2
  for (const candidate of COMMON_DOMAINS) {
    const dist = levenshtein(domain, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("DNS lookup timed out")), ms),
    ),
  ]);
}

type MxOutcome =
  | { kind: "mx"; hosts: string[] }
  | { kind: "a-only" }
  | { kind: "none" }
  | { kind: "timeout" };

async function lookupMailServers(domain: string): Promise<MxOutcome> {
  try {
    const records = await withTimeout(dns.resolveMx(domain), 5000);
    const hosts = records
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange)
      .filter((h) => h && h !== "."); // "." means null MX (RFC 7505): domain refuses mail
    if (hosts.length > 0) return { kind: "mx", hosts };
    return { kind: "none" };
  } catch (err) {
    if (err instanceof Error && err.message === "DNS lookup timed out") {
      return { kind: "timeout" };
    }
    // No MX record — RFC 5321 falls back to the domain's A/AAAA record
    try {
      const a = await withTimeout(
        Promise.any([dns.resolve4(domain), dns.resolve6(domain)]),
        5000,
      );
      return a.length > 0 ? { kind: "a-only" } : { kind: "none" };
    } catch {
      return { kind: "none" };
    }
  }
}

export async function verifyEmail(rawEmail: string): Promise<VerifyResult> {
  const email = rawEmail.trim().toLowerCase();
  const checks: Check[] = [];
  let suggestion: string | null = null;

  // 1. Syntax
  const syntaxOk = isEmail(email);
  checks.push({
    id: "syntax",
    label: "Syntax",
    status: syntaxOk ? "pass" : "fail",
    detail: syntaxOk
      ? "Address is well-formed per RFC 5322."
      : "Not a valid email address format.",
  });

  if (!syntaxOk) {
    return { email, verdict: "undeliverable", score: 0, suggestion, checks };
  }

  const [local, domain] = email.split("@");

  // 2. Typo detection
  const suggestedDomain = suggestDomain(domain);
  if (suggestedDomain) {
    suggestion = `${local}@${suggestedDomain}`;
    checks.push({
      id: "typo",
      label: "Typo check",
      status: "warn",
      detail: `"${domain}" looks like a misspelling of "${suggestedDomain}".`,
    });
  } else {
    checks.push({
      id: "typo",
      label: "Typo check",
      status: "pass",
      detail: "Domain doesn't resemble a misspelled popular provider.",
    });
  }

  // 3. Mail servers (MX / A fallback)
  const mx = await lookupMailServers(domain);
  switch (mx.kind) {
    case "mx":
      checks.push({
        id: "mx",
        label: "Mail servers",
        status: "pass",
        detail: `Domain accepts mail via ${mx.hosts.length} MX record${mx.hosts.length > 1 ? "s" : ""} (${mx.hosts[0]}).`,
      });
      break;
    case "a-only":
      checks.push({
        id: "mx",
        label: "Mail servers",
        status: "warn",
        detail:
          "No MX records, but the domain has an A/AAAA record. Mail servers may fall back to it, though this is rare for real mailboxes.",
      });
      break;
    case "none":
      checks.push({
        id: "mx",
        label: "Mail servers",
        status: "fail",
        detail: "No mail servers found for this domain. Mail cannot be delivered.",
      });
      break;
    case "timeout":
      checks.push({
        id: "mx",
        label: "Mail servers",
        status: "warn",
        detail: "DNS lookup timed out — couldn't confirm mail servers.",
      });
      break;
  }

  // 4. Disposable domain
  const disposable = DISPOSABLE.has(domain);
  checks.push({
    id: "disposable",
    label: "Disposable address",
    status: disposable ? "fail" : "pass",
    detail: disposable
      ? "Domain is a known disposable/temporary email provider."
      : "Domain is not a known disposable email provider.",
  });

  // 5. Role account
  const role = ROLE_ACCOUNTS.has(local);
  checks.push({
    id: "role",
    label: "Role account",
    status: role ? "warn" : "pass",
    detail: role
      ? `"${local}@" addresses are shared inboxes, not personal mailboxes — risky for marketing lists.`
      : "Looks like a personal (non-role) address.",
  });

  // 6. Free provider (informational only)
  const free = FREE_PROVIDERS.has(domain);
  checks.push({
    id: "provider",
    label: "Provider type",
    status: "info",
    detail: free
      ? "Free consumer email provider."
      : "Custom or business domain.",
  });

  // Scoring
  let score: number;
  if (mx.kind === "none") {
    score = 5;
  } else {
    score = 95;
    if (mx.kind === "a-only") score -= 35;
    if (mx.kind === "timeout") score -= 25;
    if (disposable) score -= 45;
    if (role) score -= 10;
    if (suggestion) score -= 15;
  }
  score = Math.max(0, Math.min(100, score));

  const verdict: Verdict =
    score >= 70 ? "deliverable" : score >= 35 ? "risky" : "undeliverable";

  return { email, verdict, score, suggestion, checks };
}
