import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: Request) {
  destroySession();
  const base = process.env.APP_URL || new URL(req.url).origin;
  return NextResponse.redirect(new URL("/login", base), { status: 303 });
}
