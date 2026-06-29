/**
 * Import real industrial sites from OpenStreetMap via the Overpass API.
 *
 * Usage:
 *   npm run import:osm -- --country FR --limit 400
 *   npm run import:osm -- --country DE --limit 300 --endpoint https://overpass.kumi.systems/api/interpreter
 *
 * OSM does not carry headcount or turnover, so those are left null on imported
 * sites (they can be enriched later, or set manually / via Claude). Industry is
 * inferred from OSM tags. Re-running is safe: rows are upserted on (source, externalId).
 */
import { PrismaClient } from "@prisma/client";
import { industryFromOsm } from "../src/lib/industries";

const prisma = new PrismaClient();

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function buildQuery(country: string, limit: number): string {
  // Industrial features that usually carry a usable name.
  return `[out:json][timeout:180];
area["ISO3166-1"="${country}"][admin_level=2]->.searchArea;
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
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:postcode"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.join(", ");
}

async function main() {
  const country = (arg("country", "FR") || "FR").toUpperCase();
  const limit = parseInt(arg("limit", "400") || "400", 10);
  const endpoint =
    arg("endpoint", "https://overpass-api.de/api/interpreter") ||
    "https://overpass-api.de/api/interpreter";

  console.log(`Querying Overpass for industrial sites in ${country} (limit ${limit})…`);

  const query = buildQuery(country, limit);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Overpass error ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as { elements: OverpassElement[] };
  const elements = json.elements || [];
  console.log(`Received ${elements.length} elements. Upserting…`);

  let upserted = 0;
  let skipped = 0;

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!name || lat == null || lon == null) {
      skipped++;
      continue;
    }

    const externalId = `${el.type}/${el.id}`;
    const industry = industryFromOsm(tags);
    const sector =
      tags.product || tags.industrial || tags.craft || tags.factory || "";

    try {
      await prisma.industrialSite.upsert({
        where: { source_externalId: { source: "osm", externalId } },
        create: {
          source: "osm",
          externalId,
          name,
          description: sector ? `${sector} (OpenStreetMap).` : "Industrial site (OpenStreetMap).",
          lat,
          lng: lon,
          country,
          region: tags["addr:state"] || "",
          city: tags["addr:city"] || "",
          address: addressOf(tags),
          industry,
          sector: typeof sector === "string" ? sector : "",
          website: tags.website || tags["contact:website"] || null,
          osmTagsJson: JSON.stringify(tags),
          tagsJson: "[]",
        },
        update: {
          name,
          industry,
          website: tags.website || tags["contact:website"] || null,
          osmTagsJson: JSON.stringify(tags),
        },
      });
      upserted++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`Done. Upserted ${upserted} sites, skipped ${skipped}.`);
  console.log(
    "Note: OSM has no headcount/turnover — enrich those later or via the Signal/tagging tools."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
