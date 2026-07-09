import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyEmail } from "@/lib/verify";

export const runtime = "nodejs"; // node:dns is unavailable on the edge runtime

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests — try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide an email address in the `email` field." },
      { status: 400 },
    );
  }
  if (email.length > 320) {
    return NextResponse.json({ error: "Email address too long." }, { status: 400 });
  }

  const result = await verifyEmail(email);
  return NextResponse.json(result);
}
