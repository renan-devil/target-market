import type { Account, IndustrialSite } from "@prisma/client";
import { parseTags } from "./types";

export type SiteWithAccount = IndustrialSite & { account: Account | null };

export interface SiteDTO {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  country: string;
  region: string;
  city: string;
  address: string;
  industry: string;
  sector: string;
  headcount: number | null;
  turnoverEur: number | null;
  website: string | null;
  source: string;
  tags: string[];
  fitScore: number | null;
  accountId: string | null;
  accountName: string | null;
  relationship: string; // "none" when unlinked
}

export function serializeSite(site: SiteWithAccount): SiteDTO {
  return {
    id: site.id,
    name: site.name,
    description: site.description,
    lat: site.lat,
    lng: site.lng,
    country: site.country,
    region: site.region,
    city: site.city,
    address: site.address,
    industry: site.industry,
    sector: site.sector,
    headcount: site.headcount,
    turnoverEur: site.turnoverEur,
    website: site.website,
    source: site.source,
    tags: parseTags(site.tagsJson),
    fitScore: site.fitScore,
    accountId: site.accountId,
    accountName: site.account?.name ?? null,
    relationship: site.account?.relationship ?? "none",
  };
}
