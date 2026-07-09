# Email Verifier

A free tool that checks whether an email address is likely real and deliverable. Built with Next.js and deployed on Vercel.

**Live: [verify.ejlee.io](https://verify.ejlee.io)**

Given an address, it runs a pipeline of checks and returns a verdict (**Deliverable / Risky / Undeliverable**) with a 0–100 confidence score and a per-check breakdown:

1. **Syntax** — RFC 5322 format validation (`validator.js`)
2. **Typo detection** — Levenshtein distance against popular providers, with a clickable "did you mean" suggestion (`gmial.com` → `gmail.com`)
3. **Mail servers** — live DNS MX lookup, with RFC 5321 A/AAAA fallback and RFC 7505 null-MX handling
4. **Disposable domains** — checked against the open [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) dataset
5. **Role accounts** — flags shared inboxes (`info@`, `support@`, `noreply@`, …)
6. **Provider type** — free consumer provider vs. custom/business domain

## Why no SMTP verification?

Commercial verifiers confirm the specific mailbox exists by opening an SMTP connection and issuing `RCPT TO`. That requires outbound port 25, which serverless platforms (Vercel, AWS Lambda, etc.) block to prevent spam — and doing it reliably requires dedicated IPs with warmed-up sending reputation. This tool is honest about that boundary: a "Deliverable" verdict means the domain accepts mail, not that the exact mailbox exists.

## Running locally

```bash
npm install
npm run dev
```

Or hit the API directly:

```bash
curl -X POST http://localhost:3000/api/verify \
  -H 'Content-Type: application/json' \
  -d '{"email": "someone@example.com"}'
```

## Privacy

Addresses are checked in-memory and never stored or logged.
