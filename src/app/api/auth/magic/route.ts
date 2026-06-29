import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMagicToken,
  isEmailAllowed,
  normalizeEmail,
  allowedDomains,
} from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid e-mail is required" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);

  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      {
        error: `Sign-in is restricted to ${allowedDomains()
          .map((d) => "@" + d)
          .join(", ")} accounts.`,
      },
      { status: 403 }
    );
  }

  const token = await createMagicToken(email);
  const base = process.env.APP_URL || new URL(req.url).origin;
  const url = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;

  await sendMagicLinkEmail({ to: email, url });

  // In dev (console provider), return the link so the UI can surface it.
  const devLink =
    (process.env.EMAIL_PROVIDER || "console").toLowerCase() === "console"
      ? url
      : undefined;

  return NextResponse.json({ ok: true, devLink });
}
