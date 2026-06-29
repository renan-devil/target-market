import type { Prisma } from "@prisma/client";

export interface SiteFilters {
  q?: string;
  countries: string[];
  industries: string[];
  relationships: string[];
  headcountMin?: number;
  headcountMax?: number;
  turnoverMinEur?: number;
  turnoverMaxEur?: number;
  fitMin?: number;
  hasAccount?: boolean;
}

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function list(v: string | null): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseFilters(params: URLSearchParams): SiteFilters {
  const hasAccountRaw = params.get("hasAccount");
  return {
    q: params.get("q")?.trim() || undefined,
    countries: list(params.get("countries")),
    industries: list(params.get("industries")),
    relationships: list(params.get("relationships")),
    headcountMin: num(params.get("headcountMin")),
    headcountMax: num(params.get("headcountMax")),
    turnoverMinEur: num(params.get("turnoverMinEur")),
    turnoverMaxEur: num(params.get("turnoverMaxEur")),
    fitMin: num(params.get("fitMin")),
    hasAccount:
      hasAccountRaw == null || hasAccountRaw === ""
        ? undefined
        : hasAccountRaw === "true",
  };
}

export function buildWhere(f: SiteFilters): Prisma.IndustrialSiteWhereInput {
  const where: Prisma.IndustrialSiteWhereInput = {};
  const and: Prisma.IndustrialSiteWhereInput[] = [];

  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q } },
        { city: { contains: f.q } },
        { sector: { contains: f.q } },
        { description: { contains: f.q } },
      ],
    });
  }
  if (f.countries.length) and.push({ country: { in: f.countries } });
  if (f.industries.length) and.push({ industry: { in: f.industries } });

  if (f.headcountMin != null) and.push({ headcount: { gte: f.headcountMin } });
  if (f.headcountMax != null) and.push({ headcount: { lte: f.headcountMax } });
  if (f.turnoverMinEur != null) and.push({ turnoverEur: { gte: f.turnoverMinEur } });
  if (f.turnoverMaxEur != null) and.push({ turnoverEur: { lte: f.turnoverMaxEur } });
  if (f.fitMin != null) and.push({ fitScore: { gte: f.fitMin } });

  if (f.hasAccount === true) and.push({ accountId: { not: null } });
  if (f.hasAccount === false) and.push({ accountId: null });

  // Relationship filter spans the related Account (plus "none" = unlinked).
  if (f.relationships.length) {
    const ors: Prisma.IndustrialSiteWhereInput[] = [];
    const accountRels = f.relationships.filter((r) => r !== "none");
    if (accountRels.length) {
      ors.push({ account: { relationship: { in: accountRels } } });
    }
    if (f.relationships.includes("none")) {
      ors.push({ accountId: null });
    }
    if (ors.length) and.push({ OR: ors });
  }

  if (and.length) where.AND = and;
  return where;
}
