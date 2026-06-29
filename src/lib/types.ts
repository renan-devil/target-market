// Shared application types. Because SQLite has no JSON/array columns, several
// of these are persisted as JSON strings — encode/decode with the helpers here.

export type Relationship =
  | "none"
  | "prospect"
  | "contacted"
  | "in_discussion"
  | "customer"
  | "churned"
  | "partner";

export const RELATIONSHIPS: { value: Relationship; label: string; color: string }[] = [
  { value: "none", label: "No account", color: "#94a3b8" },
  { value: "prospect", label: "Prospect", color: "#a78bfa" },
  { value: "contacted", label: "Contacted", color: "#60a5fa" },
  { value: "in_discussion", label: "In discussion", color: "#fbbf24" },
  { value: "customer", label: "Customer", color: "#34d399" },
  { value: "partner", label: "Partner", color: "#22d3ee" },
  { value: "churned", label: "Churned", color: "#f87171" },
];

export function relationshipMeta(value: string) {
  return RELATIONSHIPS.find((r) => r.value === value) ?? RELATIONSHIPS[0];
}

// --- Signal analysis ---------------------------------------------------------

export type SignalImportance = "high" | "medium" | "low";

export interface Signal {
  /** e.g. "Firmographic", "Technographic", "Trigger event", "Pain point" */
  category: string;
  /** short signal name, e.g. "Operates 50-500 person factories" */
  name: string;
  /** what to look for in the wild */
  description: string;
  /** why it indicates fit with the ICP */
  rationale: string;
  importance: SignalImportance;
  /** where one might observe this signal (job posts, OSM tags, press, etc.) */
  sources: string[];
}

export interface SignalAnalysisResult {
  /** one-paragraph synthesis of who the ideal customer is */
  idealCustomerSummary: string;
  /** the structured buying/fit signals */
  signals: Signal[];
  /** flat keywords useful for filtering the sites database */
  keywords: string[];
  /** suggested filters to apply against the industrial-sites map */
  suggestedFilters: {
    industries?: string[];
    countries?: string[];
    headcountMin?: number;
    headcountMax?: number;
    turnoverMinEur?: number;
    turnoverMaxEur?: number;
  };
  /** true when produced by the heuristic fallback rather than Claude */
  heuristic?: boolean;
}

// --- JSON helpers ------------------------------------------------------------

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseTags(value: string | null | undefined): string[] {
  const tags = parseJson<unknown>(value, []);
  return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [];
}
