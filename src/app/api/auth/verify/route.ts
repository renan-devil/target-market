import { NextResponse } from "next/server";
import { consumeMagicToken, createSession, upsertUserOnLogin } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const base = process.env.APP_URL || url.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing", base));
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid", base));
  }

  const user = await upsertUserOnLogin(email);
  await createSession(user);

  return NextResponse.redirect(new URL("/dashboard", base));
}
