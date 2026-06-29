import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildWhere, parseFilters } from "@/lib/site-filters";
import { serializeSite } from "@/lib/serialize";

const MAX_RESULTS = 5000;

export async function GET(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filters = parseFilters(url.searchParams);
  const where = buildWhere(filters);

  const [sites, total] = await Promise.all([
    prisma.industrialSite.findMany({
      where,
      include: { account: true },
      take: MAX_RESULTS,
      orderBy: [{ fitScore: "desc" }, { headcount: "desc" }],
    }),
    prisma.industrialSite.count({ where }),
  ]);

  return NextResponse.json({
    sites: sites.map(serializeSite),
    total,
    truncated: total > sites.length,
  });
}
