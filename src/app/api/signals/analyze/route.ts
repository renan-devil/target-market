import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeIcp, claudeEnabled } from "@/lib/claude";

const schema = z.object({
  profileId: z.string().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  websiteText: z.string().max(40000).default(""),
  icpText: z.string().max(20000).default(""),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { profileId, websiteText, icpText } = parsed.data;

  if (!websiteText.trim() && !icpText.trim()) {
    return NextResponse.json(
      { error: "Provide website copy and/or an ICP description." },
      { status: 400 }
    );
  }

  const name =
    parsed.data.name?.trim() ||
    `Analysis ${new Date().toISOString().slice(0, 10)}`;

  const analysis = await analyzeIcp(websiteText, icpText);

  const data = {
    name,
    websiteText,
    icpText,
    analysisJson: JSON.stringify(analysis),
    model: analysis.heuristic ? "heuristic" : process.env.ANTHROPIC_MODEL || "claude",
    analyzedAt: new Date(),
  };

  let profile;
  if (profileId) {
    // Make sure the profile belongs to this user before updating.
    const existing = await prisma.icpProfile.findFirst({
      where: { id: profileId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    profile = await prisma.icpProfile.update({
      where: { id: profileId },
      data,
    });
  } else {
    profile = await prisma.icpProfile.create({
      data: { ...data, userId: user.id },
    });
  }

  return NextResponse.json({
    profileId: profile.id,
    analysis,
    claudeEnabled: claudeEnabled(),
  });
}
