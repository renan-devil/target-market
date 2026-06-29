// Shared OpenStreetMap (Overpass) import logic, used by both the CLI
// (scripts/import-osm.ts) and the in-app sync API (/api/sites/sync).
//
// OSM does not carry headcount or turnover, so those are left null on imported
// sites. Industry is inferred from OSM tags. Imports are idempotent: rows are
// upserted on the (source, externalId) unique key.

import type { PrismaClient } from "@prisma/client";
import { industryFromOsm } from "./industries";

export const DEFAULT_OVERPASS_ENDPOINT =
  process.env.OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter";

export const SYNCABLE_LIMIT = { min: 1, max: 2000, default: 400 };

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface ImportResult {
  country: string;
  received: number;
  upserted: number;
  skipped: number;
}

export function buildOverpassQuery(country: string, limit: number): string {
  const iso = country.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  // Industrial features that usually carry a usable name.
  return `[out:json][timeout:180];
area["ISO3166-1"="${iso}"][admin_level=2]->.searchArea;
(
  way["man_made"="works"]["name"](area.searchArea);
  relation["man_made"="works"]["name"](area.searchArea);
  way["landuse"="industrial"]["name"](area.searchArea);
  way["building"="industrial"]["name"](area.searchArea);
  node["man_made"="works"]["name"](area.searchArea);
);
out center tags ${limit};`;
}

function addressOf(tags: Record<string, string>): string {
  return [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"],
  ]
    .filter(Boolean)
    .join(", ");
}

interface ParsedSite {
  externalId: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  region: string;
  city: string;
  address: string;
  industry: string;
  sector: string;
  website: string | null;
  osmTagsJson: string;
}

/** Convert one Overpass element into site data, or null if unusable. */
export function elementToSite(el: OverpassElement): ParsedSite | null {
  const tags = el.tags || {};
  const name = tags.name;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;

  const sector =
    tags.product || tags.industrial || tags.craft || tags.factory || "";

  return {
    externalId: `${el.type}/${el.id}`,
    name,
    description: sector
      ? `${sector} (OpenStreetMap).`
      : "Industrial site (OpenStreetMap).",
    lat,
    lng: lon,
    region: tags["addr:state"] || "",
    city: tags["addr:city"] || "",
    address: addressOf(tags),
    industry: industryFromOsm(tags),
    sector: typeof sector === "string" ? sector : "",
    website: tags.website || tags["contact:website"] || null,
    osmTagsJson: JSON.stringify(tags),
  };
}

/** Fetch raw Overpass elements for a country. Throws on network/HTTP errors. */
export async function fetchOverpass(
  country: string,
  limit: number,
  endpoint = DEFAULT_OVERPASS_ENDPOINT
): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(country, limit);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Overpass error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { elements?: OverpassElement[] };
  return json.elements || [];
}

/**
 * Import industrial sites for one country into the database.
 * Idempotent upsert on (source="osm", externalId).
 */
export async function importOsmCountry(
  prisma: PrismaClient,
  opts: { country: string; limit?: number; endpoint?: string }
): Promise<ImportResult> {
  const country = opts.country.toUpperCase().slice(0, 2);
  const limit = Math.min(
    SYNCABLE_LIMIT.max,
    Math.max(SYNCABLE_LIMIT.min, opts.limit ?? SYNCABLE_LIMIT.default)
  );

  const elements = await fetchOverpass(country, limit, opts.endpoint);

  let upserted = 0;
  let skipped = 0;

  for (const el of elements) {
    const site = elementToSite(el);
    if (!site) {
      skipped++;
      continue;
    }
    try {
      await prisma.industrialSite.upsert({
        where: { source_externalId: { source: "osm", externalId: site.externalId } },
        create: {
          source: "osm",
          externalId: site.externalId,
          name: site.name,
          description: site.description,
          lat: site.lat,
          lng: site.lng,
          country,
          region: site.region,
          city: site.city,
          address: site.address,
          industry: site.industry,
          sector: site.sector,
          website: site.website,
          osmTagsJson: site.osmTagsJson,
          tagsJson: "[]",
        },
        update: {
          name: site.name,
          industry: site.industry,
          sector: site.sector,
          website: site.website,
          osmTagsJson: site.osmTagsJson,
        },
      });
      upserted++;
    } catch {
      skipped++;
    }
  }

  return { country, received: elements.length, upserted, skipped };
}
