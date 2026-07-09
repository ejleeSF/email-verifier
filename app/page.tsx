"use client";

import { useEffect, useState } from "react";

type CheckStatus = "pass" | "warn" | "fail" | "info" | "skip";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

interface VerifyResult {
  email: string;
  verdict: "deliverable" | "risky" | "undeliverable";
  score: number;
  suggestion: string | null;
  checks: Check[];
}

const STATUS_ICON: Record<CheckStatus, string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  info: "i",
  skip: "–",
};

const STATUS_STYLE: Record<CheckStatus, string> = {
  pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  skip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const VERDICT_META = {
  deliverable: {
    label: "Deliverable",
    style:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  risky: {
    label: "Risky",
    style: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  undeliverable: {
    label: "Undeliverable",
    style: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    bar: "bg-red-500",
  },
} as const;

export default function Home() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("email");
    if (q) check(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(target?: string) {
    const value = (target ?? email).trim();
    if (!value || loading) return;
    if (target) setEmail(target);
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    window.history.replaceState(null, "", `/?email=${encodeURIComponent(value)}`);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    const url = `${window.location.origin}/?email=${encodeURIComponent(result.email)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const verdict = result ? VERDICT_META[result.verdict] : null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Email Verifier
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Check whether an email address is likely to be real and deliverable —
          syntax, mail servers, disposable domains, typos, and role accounts.
        </p>

        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && verdict && (
          <div className="mt-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm text-zinc-500 dark:text-zinc-400">
                  {result.email}
                </div>
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${verdict.style}`}
                >
                  {verdict.label}
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                  {result.score}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  confidence
                </div>
              </div>
            </div>

            <div className="mt-4 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${verdict.bar} transition-all duration-500`}
                style={{ width: `${result.score}%` }}
              />
            </div>

            <button
              onClick={copyLink}
              className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {copied ? "Link copied ✓" : "Copy shareable link"}
            </button>

            {result.suggestion && (
              <button
                onClick={() => check(result.suggestion!)}
                className="mt-4 w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-4 py-2 text-left text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                Did you mean{" "}
                <span className="font-semibold underline">
                  {result.suggestion}
                </span>
                ? Click to check it.
              </button>
            )}

            <ul className="mt-6 space-y-3">
              {result.checks.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STATUS_STYLE[c.status]}`}
                  >
                    {STATUS_ICON[c.status]}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {c.label}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {c.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="mt-10 group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <summary className="cursor-pointer select-none px-5 py-4 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100">
            How it works
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-4">
            <p>Every address runs through six checks, live:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Syntax</strong> —
                is it a well-formed address per RFC 5322?
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Typo detection</strong> —
                edit distance against popular providers catches slips like{" "}
                <code className="text-xs">gmial.com</code> and suggests the fix.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Mail servers</strong> —
                a live DNS lookup confirms the domain publishes MX records
                (or an A-record fallback) that can actually receive mail.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Disposable domains</strong> —
                checked against an open dataset of thousands of throwaway
                email providers.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Role accounts</strong> —
                shared inboxes like <code className="text-xs">info@</code> or{" "}
                <code className="text-xs">noreply@</code> get flagged; they&apos;re
                risky targets for personal correspondence or marketing lists.
              </li>
              <li>
                <strong className="text-zinc-800 dark:text-zinc-200">Provider type</strong> —
                free consumer provider vs. custom/business domain, for context.
              </li>
            </ol>
            <p>
              <strong className="text-zinc-800 dark:text-zinc-200">
                Why not verify the exact mailbox?
              </strong>{" "}
              Commercial verifiers open an SMTP connection and ask the mail
              server whether the mailbox exists (<code className="text-xs">RCPT TO</code>).
              That requires outbound port 25, which serverless platforms like
              Vercel block to prevent spam — and doing it reliably takes
              dedicated servers with warmed-up sending reputation. So a
              &ldquo;Deliverable&rdquo; verdict here means the domain accepts
              mail, not that the specific mailbox exists. This tool prefers
              being honest about that boundary over pretending otherwise.
            </p>
            <p>
              Addresses are checked in-memory and never stored or logged.
            </p>
          </div>
        </details>

        <footer className="mt-10 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>
            Built by{" "}
            <a
              href="https://github.com/ejleeSF"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
            >
              EJ Lee
            </a>
          </span>
          <a
            href="https://github.com/ejleeSF/email-verifier"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline underline-offset-2"
          >
            Source on GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}
