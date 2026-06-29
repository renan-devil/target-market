import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson, type SignalAnalysisResult } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const profile = await prisma.icpProfile.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      websiteText: profile.websiteText,
      icpText: profile.icpText,
      model: profile.model,
      analyzedAt: profile.analyzedAt,
      analysis: parseJson<SignalAnalysisResult | null>(profile.analysisJson, null),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  await prisma.icpProfile
    .deleteMany({ where: { id: params.id, userId: user.id } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
