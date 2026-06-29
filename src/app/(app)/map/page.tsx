import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { claudeEnabled } from "@/lib/claude";
import { MapExplorer, type MapFilters } from "@/components/MapExplorer";

export const dynamic = "force-dynamic";

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(",") : v;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v[0] : v;
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();

  const profiles = user
    ? await prisma.icpProfile.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true },
      })
    : [];

  const initialFilters: MapFilters = {
    q: asString(searchParams.q),
    countries: asArray(searchParams.countries),
    industries: asArray(searchParams.industries),
    relationships: asArray(searchParams.relationships),
    headcountMin: asString(searchParams.headcountMin),
    headcountMax: asString(searchParams.headcountMax),
    fitMin: asString(searchParams.fitMin),
  };

  return (
    <MapExplorer
      initialFilters={initialFilters}
      profiles={profiles}
      claudeEnabled={claudeEnabled()}
    />
  );
}
