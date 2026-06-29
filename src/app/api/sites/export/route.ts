import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildWhere, parseFilters } from "@/lib/site-filters";
import { serializeSite } from "@/lib/serialize";
import { toCsv } from "@/lib/csv";
import { countryLabel } from "@/lib/industries";

const EXPORT_LIMIT = 50000;

export async function GET(req: Request) {
  try {
    await requireUser();
  } catch {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);

  // Optional explicit selection (comma-separated ids) overrides filters.
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const where = ids.length
    ? { id: { in: ids } }
    : buildWhere(parseFilters(url.searchParams));

  const rows = await prisma.industrialSite.findMany({
    where,
    include: { account: true },
    take: EXPORT_LIMIT,
    orderBy: [{ fitScore: "desc" }, { headcount: "desc" }],
  });

  const dtos = rows.map(serializeSite).map((s) => ({
    name: s.name,
    industry: s.industry,
    sector: s.sector,
    country: countryLabel(s.country),
    city: s.city,
    address: s.address,
    headcount: s.headcount ?? "",
    turnover_eur: s.turnoverEur ?? "",
    fit_score: s.fitScore ?? "",
    account: s.accountName ?? "",
    relationship: s.relationship,
    tags: s.tags.join("; "),
    website: s.website ?? "",
    latitude: s.lat,
    longitude: s.lng,
  }));

  const csv = toCsv(dtos, [
    { key: "name", header: "Name" },
    { key: "industry", header: "Industry" },
    { key: "sector", header: "Sector" },
    { key: "country", header: "Country" },
    { key: "city", header: "City" },
    { key: "address", header: "Address" },
    { key: "headcount", header: "Headcount" },
    { key: "turnover_eur", header: "Turnover (EUR)" },
    { key: "fit_score", header: "Fit score" },
    { key: "account", header: "Account" },
    { key: "relationship", header: "Relationship" },
    { key: "tags", header: "Tags" },
    { key: "website", header: "Website" },
    { key: "latitude", header: "Latitude" },
    { key: "longitude", header: "Longitude" },
  ]);

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="industrial-sites-${date}.csv"`,
    },
  });
}
