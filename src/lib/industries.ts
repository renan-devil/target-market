// High-level industry taxonomy used for filtering and AI tagging. Kept small and
// stable so it can drive both the map legend and CSV exports. OSM landuse/industrial
// values are mapped into these buckets by scripts/import-osm.ts.

export const INDUSTRIES = [
  "Food & Beverage",
  "Automotive",
  "Aerospace & Defense",
  "Chemicals",
  "Pharmaceuticals",
  "Metals & Foundry",
  "Machinery & Equipment",
  "Electronics & Semiconductors",
  "Plastics & Rubber",
  "Textiles & Apparel",
  "Paper & Packaging",
  "Building Materials",
  "Energy & Utilities",
  "Logistics & Warehousing",
  "Wood & Furniture",
  "Glass & Ceramics",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const COUNTRIES: { code: string; label: string; flag: string }[] = [
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "BE", label: "Belgium", flag: "🇧🇪" },
  { code: "PL", label: "Poland", flag: "🇵🇱" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "US", label: "United States", flag: "🇺🇸" },
];

export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

// Map raw OpenStreetMap industrial tag values to our high-level industries.
// Used by the Overpass importer. Lowercased keys.
const OSM_PRODUCT_TO_INDUSTRY: Record<string, Industry> = {
  food: "Food & Beverage",
  beverages: "Food & Beverage",
  brewery: "Food & Beverage",
  dairy: "Food & Beverage",
  bakery: "Food & Beverage",
  meat: "Food & Beverage",
  car: "Automotive",
  cars: "Automotive",
  automobile: "Automotive",
  vehicle: "Automotive",
  aircraft: "Aerospace & Defense",
  aerospace: "Aerospace & Defense",
  chemical: "Chemicals",
  chemicals: "Chemicals",
  paint: "Chemicals",
  pharmaceutical: "Pharmaceuticals",
  pharmaceuticals: "Pharmaceuticals",
  steel: "Metals & Foundry",
  metal: "Metals & Foundry",
  aluminium: "Metals & Foundry",
  foundry: "Metals & Foundry",
  smelting: "Metals & Foundry",
  machine: "Machinery & Equipment",
  machinery: "Machinery & Equipment",
  electronics: "Electronics & Semiconductors",
  semiconductor: "Electronics & Semiconductors",
  plastic: "Plastics & Rubber",
  plastics: "Plastics & Rubber",
  rubber: "Plastics & Rubber",
  textile: "Textiles & Apparel",
  clothing: "Textiles & Apparel",
  paper: "Paper & Packaging",
  packaging: "Paper & Packaging",
  cement: "Building Materials",
  concrete: "Building Materials",
  brick: "Building Materials",
  glass: "Glass & Ceramics",
  ceramic: "Glass & Ceramics",
  wood: "Wood & Furniture",
  furniture: "Wood & Furniture",
  sawmill: "Wood & Furniture",
  energy: "Energy & Utilities",
  power: "Energy & Utilities",
};

export function industryFromOsm(tags: Record<string, string>): Industry {
  const candidates = [
    tags.product,
    tags["industrial"],
    tags.craft,
    tags.man_made,
    tags.factory,
    tags.works,
  ]
    .filter(Boolean)
    .map((v) => v!.toLowerCase());

  for (const c of candidates) {
    for (const [key, industry] of Object.entries(OSM_PRODUCT_TO_INDUSTRY)) {
      if (c.includes(key)) return industry;
    }
  }
  return "Other";
}
