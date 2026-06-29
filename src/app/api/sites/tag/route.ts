import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tagSites, claudeEnabled, type SiteForTagging } from "@/lib/claude";
import { parseJson, type SignalAnalysisResult } from "@/lib/types";
import { serializeSite } from "@/lib/serialize";

const MAX_TAG_BATCH = 80;

const schema = z.object({
  siteIds: z.array(z.string()).min(1).max(MAX_TAG_BATCH),
  profileId: z.string().optional(),
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
    return NextResponse.json(
      { error: `Provide 1-${MAX_TAG_BATCH} site IDs.` },
      { status: 400 }
    );
  }
  const { siteIds, profileId } = parsed.data;

  // Load the ICP analysis to score against, if a profile was chosen.
  let analysis: SignalAnalysisResult | null = null;
  if (profileId) {
    const profile = await prisma.icpProfile.findFirst({
      where: { id: profileId, userId: user.id },
    });
    if (profile?.analysisJson) {
      analysis = parseJson<SignalAnalysisResult | null>(profile.analysisJson, null);
    }
  }

  const sites = await prisma.industrialSite.findMany({
    where: { id: { in: siteIds } },
  });

  const forTagging: SiteForTagging[] = sites.map((s) => ({
    id: s.id,
    name: s.name,
    industry: s.industry,
    sector: s.sector,
    country: s.country,
    city: s.city,
    headcount: s.headcount,
    turnoverEur: s.turnoverEur,
    description: s.description,
  }));

  const results = await tagSites(forTagging, analysis);

  // Persist tags + fit scores.
  await prisma.$transaction(
    results.map((r) =>
      prisma.industrialSite.update({
        where: { id: r.id },
        data: {
          tagsJson: JSON.stringify(r.tags.slice(0, 12)),
          fitScore: Math.max(0, Math.min(100, Math.round(r.fitScore))),
        },
      })
    )
  );

  const updated = await prisma.industrialSite.findMany({
    where: { id: { in: siteIds } },
    include: { account: true },
  });

  return NextResponse.json({
    sites: updated.map(serializeSite),
    usedClaude: claudeEnabled(),
    scoredAgainstIcp: Boolean(analysis),
  });
}
