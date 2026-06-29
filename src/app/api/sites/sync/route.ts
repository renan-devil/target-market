import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { importOsmCountry, SYNCABLE_LIMIT } from "@/lib/osm";
import { COUNTRIES } from "@/lib/industries";

// Overpass queries can take a while; allow a longer function duration where the
// host honours it (e.g. Vercel).
export const maxDuration = 120;

const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [string, ...string[]];

/** GET — counts of sites grouped by source, for the Data page. */
export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const [grouped, total] = await Promise.all([
    prisma.industrialSite.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
    prisma.industrialSite.count(),
  ]);

  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.source] = g._count._all;

  return NextResponse.json({ counts, total });
}

const syncSchema = z.object({
  country: z.enum(COUNTRY_CODES),
  limit: z.number().int().min(SYNCABLE_LIMIT.min).max(SYNCABLE_LIMIT.max).optional(),
});

/** POST — import one country from OpenStreetMap. */
export async function POST(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a supported country code." },
      { status: 400 }
    );
  }

  try {
    const result = await importOsmCountry(prisma, {
      country: parsed.data.country,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // Network / Overpass / egress errors surface here with a readable message.
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 502 }
    );
  }
}

const deleteSchema = z.object({
  source: z.enum(["seed", "osm"]),
});

/** DELETE — clear all sites from a given source (e.g. remove the sample seed). */
export async function DELETE(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Specify source to clear." }, { status: 400 });
  }

  const { count } = await prisma.industrialSite.deleteMany({
    where: { source: parsed.data.source },
  });

  return NextResponse.json({ ok: true, deleted: count });
}
