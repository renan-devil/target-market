/**
 * Import real industrial sites from OpenStreetMap via the Overpass API.
 *
 * Usage:
 *   npm run import:osm -- --country FR --limit 400
 *   npm run import:osm -- --country FR,DE,US --limit 400
 *   npm run import:osm -- --country BE --endpoint https://overpass.kumi.systems/api/interpreter
 *
 * Options:
 *   --country   ISO-2 code(s), comma-separated (default FR)
 *   --limit     max sites per country (default 400)
 *   --endpoint  Overpass endpoint (default overpass-api.de, or OVERPASS_ENDPOINT)
 *
 * OSM has no headcount/turnover — those are left empty on imported sites.
 * Re-running is safe: rows are upserted on (source, externalId).
 */
import { PrismaClient } from "@prisma/client";
import { importOsmCountry, DEFAULT_OVERPASS_ENDPOINT } from "../src/lib/osm";

const prisma = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const countries = (arg("country", "FR") || "FR")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const limit = parseInt(arg("limit", "400") || "400", 10);
  const endpoint = arg("endpoint", DEFAULT_OVERPASS_ENDPOINT) || DEFAULT_OVERPASS_ENDPOINT;

  let totalUpserted = 0;
  for (const country of countries) {
    console.log(`Querying Overpass for ${country} (limit ${limit})…`);
    try {
      const r = await importOsmCountry(prisma, { country, limit, endpoint });
      console.log(
        `  ${country}: received ${r.received}, upserted ${r.upserted}, skipped ${r.skipped}`
      );
      totalUpserted += r.upserted;
    } catch (e) {
      console.error(`  ${country}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. Upserted ${totalUpserted} sites across ${countries.length} country(ies).`);
  console.log(
    "Note: OSM has no headcount/turnover — enrich those later or via the tagging tools."
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
