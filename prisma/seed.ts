/**
 * Seed the database with a realistic sample of industrial sites, a few OSS
 * accounts, and the penetration links between them. Safe to re-run: it clears
 * seed-sourced rows first. Real data can be layered in via `npm run import:osm`.
 */
import { PrismaClient } from "@prisma/client";
import { INDUSTRIES } from "../src/lib/industries";

const prisma = new PrismaClient();

// [lng, lat] anchors for real industrial cities, grouped by country.
const CITIES: Record<string, { city: string; region: string; lng: number; lat: number }[]> = {
  FR: [
    { city: "Lyon", region: "Auvergne-Rhône-Alpes", lng: 4.835, lat: 45.764 },
    { city: "Lille", region: "Hauts-de-France", lng: 3.057, lat: 50.629 },
    { city: "Toulouse", region: "Occitanie", lng: 1.444, lat: 43.604 },
    { city: "Le Havre", region: "Normandie", lng: 0.107, lat: 49.494 },
    { city: "Strasbourg", region: "Grand Est", lng: 7.751, lat: 48.573 },
    { city: "Grenoble", region: "Auvergne-Rhône-Alpes", lng: 5.724, lat: 45.188 },
    { city: "Nantes", region: "Pays de la Loire", lng: -1.553, lat: 47.218 },
    { city: "Dunkerque", region: "Hauts-de-France", lng: 2.377, lat: 51.034 },
    { city: "Clermont-Ferrand", region: "Auvergne-Rhône-Alpes", lng: 3.087, lat: 45.777 },
    { city: "Valenciennes", region: "Hauts-de-France", lng: 3.524, lat: 50.358 },
  ],
  DE: [
    { city: "Stuttgart", region: "Baden-Württemberg", lng: 9.182, lat: 48.776 },
    { city: "Munich", region: "Bavaria", lng: 11.582, lat: 48.135 },
    { city: "Hamburg", region: "Hamburg", lng: 9.993, lat: 53.551 },
    { city: "Cologne", region: "North Rhine-Westphalia", lng: 6.96, lat: 50.938 },
    { city: "Wolfsburg", region: "Lower Saxony", lng: 10.787, lat: 52.423 },
    { city: "Ludwigshafen", region: "Rhineland-Palatinate", lng: 8.446, lat: 49.481 },
  ],
  ES: [
    { city: "Barcelona", region: "Catalonia", lng: 2.154, lat: 41.39 },
    { city: "Valencia", region: "Valencia", lng: -0.376, lat: 39.47 },
    { city: "Bilbao", region: "Basque Country", lng: -2.935, lat: 43.263 },
    { city: "Zaragoza", region: "Aragon", lng: -0.889, lat: 41.649 },
  ],
  IT: [
    { city: "Milan", region: "Lombardy", lng: 9.19, lat: 45.464 },
    { city: "Turin", region: "Piedmont", lng: 7.687, lat: 45.07 },
    { city: "Bologna", region: "Emilia-Romagna", lng: 11.343, lat: 44.494 },
  ],
  NL: [
    { city: "Rotterdam", region: "South Holland", lng: 4.477, lat: 51.924 },
    { city: "Eindhoven", region: "North Brabant", lng: 5.469, lat: 51.441 },
  ],
  BE: [
    { city: "Antwerp", region: "Flanders", lng: 4.402, lat: 51.26 },
    { city: "Ghent", region: "Flanders", lng: 3.725, lat: 51.054 },
  ],
  PL: [
    { city: "Katowice", region: "Silesia", lng: 19.024, lat: 50.265 },
    { city: "Wrocław", region: "Lower Silesia", lng: 17.038, lat: 51.108 },
  ],
  GB: [
    { city: "Birmingham", region: "West Midlands", lng: -1.898, lat: 52.486 },
    { city: "Manchester", region: "North West", lng: -2.244, lat: 53.483 },
    { city: "Sunderland", region: "North East", lng: -1.382, lat: 54.906 },
  ],
  US: [
    { city: "Detroit, MI", region: "Michigan", lng: -83.046, lat: 42.331 },
    { city: "Houston, TX", region: "Texas", lng: -95.369, lat: 29.76 },
    { city: "Chicago, IL", region: "Illinois", lng: -87.65, lat: 41.85 },
    { city: "Charlotte, NC", region: "North Carolina", lng: -80.843, lat: 35.227 },
    { city: "Cincinnati, OH", region: "Ohio", lng: -84.512, lat: 39.103 },
    { city: "Greenville, SC", region: "South Carolina", lng: -82.394, lat: 34.852 },
  ],
};

const NAME_PREFIX = [
  "Atlas", "Vulcan", "Nord", "Préci", "Meridian", "Apex", "Helios", "Granit",
  "Cobalt", "Forge", "Orion", "Delta", "Pioneer", "Summit", "Cardinal", "Vertex",
  "Aurora", "Titan", "Lumen", "Quartz", "Arclight", "Ironwood", "Sterling", "Beacon",
];

const SECTOR_BY_INDUSTRY: Record<string, string[]> = {
  "Food & Beverage": ["Dairy processing", "Beverage bottling", "Bakery & snacks", "Meat processing"],
  Automotive: ["Powertrain components", "Body & assembly", "EV battery systems", "Tier-1 supplier"],
  "Aerospace & Defense": ["Structural parts", "Avionics", "Engine components"],
  Chemicals: ["Specialty chemicals", "Coatings & paints", "Agrochemicals"],
  Pharmaceuticals: ["API manufacturing", "Sterile fill-finish", "Generics"],
  "Metals & Foundry": ["Steel rolling", "Aluminium casting", "Precision foundry"],
  "Machinery & Equipment": ["Industrial machinery", "Hydraulics", "Pumps & valves"],
  "Electronics & Semiconductors": ["PCB assembly", "Power electronics", "Sensors"],
  "Plastics & Rubber": ["Injection moulding", "Extrusion", "Tyre components"],
  "Textiles & Apparel": ["Technical textiles", "Apparel manufacturing", "Nonwovens"],
  "Paper & Packaging": ["Corrugated packaging", "Flexible packaging", "Tissue"],
  "Building Materials": ["Cement", "Precast concrete", "Insulation"],
  "Energy & Utilities": ["Combined-cycle plant", "Biogas", "Grid equipment"],
  "Logistics & Warehousing": ["Distribution center", "Cold storage", "Fulfilment"],
  "Wood & Furniture": ["Sawmill", "Panel production", "Office furniture"],
  "Glass & Ceramics": ["Flat glass", "Container glass", "Technical ceramics"],
  Other: ["Industrial site"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(v: number, amount: number): number {
  return v + (Math.random() - 0.5) * amount;
}

// Roughly lognormal headcount between ~30 and ~6000.
function randomHeadcount(): number {
  const base = Math.exp(3.5 + Math.random() * 3.2);
  return Math.max(25, Math.round(base / 5) * 5);
}

// Turnover correlated with headcount: ~120-450k EUR per employee, with noise.
function turnoverFor(headcount: number): number {
  const perHead = 120_000 + Math.random() * 330_000;
  return Math.round((headcount * perHead) / 100_000) * 100_000;
}

async function main() {
  console.log("Clearing existing seed data…");
  await prisma.industrialSite.deleteMany({ where: { source: "seed" } });
  // Only remove accounts that have no remaining links.
  await prisma.account.deleteMany({});

  // --- Accounts -------------------------------------------------------------
  const accountSpecs = [
    { name: "Saveurs du Nord", domain: "saveursdunord.fr", relationship: "customer" },
    { name: "Rhône Précision", domain: "rhone-precision.fr", relationship: "customer" },
    { name: "BavariaTech GmbH", domain: "bavariatech.de", relationship: "in_discussion" },
    { name: "Iberia Plastics", domain: "iberiaplastics.es", relationship: "prospect" },
    { name: "Lowlands Logistics", domain: "lowlands-log.nl", relationship: "contacted" },
    { name: "Great Lakes Forge", domain: "glforge.com", relationship: "partner" },
    { name: "Midlands Components", domain: "midlandscomp.co.uk", relationship: "prospect" },
    { name: "Silesia Steel", domain: "silesiasteel.pl", relationship: "churned" },
  ];
  const accounts = [] as { id: string; relationship: string }[];
  for (const spec of accountSpecs) {
    const a = await prisma.account.create({
      data: {
        name: spec.name,
        domain: spec.domain,
        relationship: spec.relationship,
        ownerEmail: "renan@oss.ventures",
      },
    });
    accounts.push({ id: a.id, relationship: spec.relationship });
  }

  // --- Sites ----------------------------------------------------------------
  const PER_COUNTRY: Record<string, number> = {
    FR: 45, DE: 24, ES: 14, IT: 12, NL: 8, BE: 8, PL: 8, GB: 14, US: 24,
  };

  let created = 0;
  let externalCounter = 1;

  for (const [country, n] of Object.entries(PER_COUNTRY)) {
    const cities = CITIES[country];
    for (let i = 0; i < n; i++) {
      const anchor = pick(cities);
      const industry = pick(INDUSTRIES as unknown as string[]);
      const sector = pick(SECTOR_BY_INDUSTRY[industry] || ["Industrial site"]);
      const headcount = randomHeadcount();
      const turnover = turnoverFor(headcount);
      const suffix = pick(["Works", "Plant", "Facility", "Site", "Manufacturing"]);
      const name = `${pick(NAME_PREFIX)} ${industry.split(" ")[0]} ${suffix}`;

      // ~22% of sites belong to a known account (penetration).
      const linkAccount = Math.random() < 0.22 ? pick(accounts) : null;

      await prisma.industrialSite.create({
        data: {
          source: "seed",
          externalId: `seed-${externalCounter++}`,
          name,
          description: `${sector} site near ${anchor.city}.`,
          lat: jitter(anchor.lat, 0.35),
          lng: jitter(anchor.lng, 0.45),
          country,
          region: anchor.region,
          city: anchor.city,
          industry,
          sector,
          headcount,
          turnoverEur: turnover,
          accountId: linkAccount?.id ?? null,
          tagsJson: "[]",
        },
      });
      created++;
    }
  }

  console.log(`Seeded ${created} industrial sites and ${accounts.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
