import Anthropic from "@anthropic-ai/sdk";
import { INDUSTRIES } from "./industries";
import type { Signal, SignalAnalysisResult } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function claudeEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  // Use the public Anthropic API explicitly with the app's own key — do not
  // inherit any harness ANTHROPIC_BASE_URL.
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

/** Pull the first text block out of a Messages response. */
function textOf(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Best-effort extraction of a JSON object from a model response. */
function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ICP / signal analysis
// ---------------------------------------------------------------------------

const ANALYSIS_SYSTEM = `You are a B2B go-to-market analyst for an operator-led venture studio.
Given a company's website copy and/or a description of their Ideal Customer Profile (ICP),
you identify the concrete, observable SIGNALS that indicate a prospect is a strong fit.

Focus on industrial / manufacturing buyers. Signals must be things one could actually
observe or filter on (firmographics, technographics, trigger events, pain points, hiring,
certifications, etc.). Be specific and practical, not generic.

Return ONLY a JSON object with this exact shape:
{
  "idealCustomerSummary": string,
  "signals": [
    {
      "category": "Firmographic" | "Technographic" | "Trigger event" | "Pain point" | "Operational" | "Other",
      "name": string,
      "description": string,
      "rationale": string,
      "importance": "high" | "medium" | "low",
      "sources": string[]
    }
  ],
  "keywords": string[],
  "suggestedFilters": {
    "industries": string[],
    "countries": string[],
    "headcountMin": number,
    "headcountMax": number,
    "turnoverMinEur": number,
    "turnoverMaxEur": number
  }
}
For "suggestedFilters.industries", only use values from this list when relevant: ${INDUSTRIES.join(", ")}.
Use ISO-2 country codes (FR, DE, US, ...) for "countries". Omit numeric filter fields you cannot infer.`;

export async function analyzeIcp(
  websiteText: string,
  icpText: string
): Promise<SignalAnalysisResult> {
  if (!claudeEnabled()) {
    return heuristicAnalysis(websiteText, icpText);
  }

  const userContent = [
    icpText.trim() ? `ICP description:\n${icpText.trim()}` : "",
    websiteText.trim() ? `Website copy:\n${websiteText.trim().slice(0, 12000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  try {
    const message = await client().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: ANALYSIS_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
    const parsed = extractJson<SignalAnalysisResult>(textOf(message));
    if (parsed && Array.isArray(parsed.signals)) {
      return { ...parsed, heuristic: false };
    }
  } catch (err) {
    console.error("Claude analyzeIcp failed, falling back to heuristic:", err);
  }
  return heuristicAnalysis(websiteText, icpText);
}

// ---------------------------------------------------------------------------
// Site tagging / fit scoring
// ---------------------------------------------------------------------------

export interface SiteForTagging {
  id: string;
  name: string;
  industry: string;
  sector: string;
  country: string;
  city: string;
  headcount: number | null;
  turnoverEur: number | null;
  description: string;
}

export interface SiteTagResult {
  id: string;
  tags: string[];
  fitScore: number; // 0-100
  rationale: string;
}

const TAGGING_SYSTEM = `You classify industrial sites for a B2B sales team.
For each site, output 2-5 concise lowercase tags and a fit score (0-100) indicating how
well the site matches the provided Ideal Customer Profile signals. Higher = better fit.
Return ONLY JSON: { "results": [ { "id": string, "tags": string[], "fitScore": number, "rationale": string } ] }.`;

export async function tagSites(
  sites: SiteForTagging[],
  analysis: SignalAnalysisResult | null
): Promise<SiteTagResult[]> {
  if (!sites.length) return [];
  if (!claudeEnabled()) {
    return sites.map((s) => heuristicTag(s, analysis));
  }

  const icpContext = analysis
    ? `ICP: ${analysis.idealCustomerSummary}\nKey signals: ${analysis.signals
        .map((s) => `${s.name} (${s.importance})`)
        .join("; ")}\nKeywords: ${analysis.keywords.join(", ")}`
    : "No specific ICP provided. Tag by industry, scale, and notable operational traits.";

  try {
    const message = await client().messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: TAGGING_SYSTEM,
      messages: [
        {
          role: "user",
          content: `${icpContext}\n\nSites (JSON):\n${JSON.stringify(sites)}`,
        },
      ],
    });
    const parsed = extractJson<{ results: SiteTagResult[] }>(textOf(message));
    if (parsed && Array.isArray(parsed.results)) {
      // Make sure every input site has a result.
      const byId = new Map(parsed.results.map((r) => [r.id, r]));
      return sites.map(
        (s) =>
          byId.get(s.id) ?? heuristicTag(s, analysis)
      );
    }
  } catch (err) {
    console.error("Claude tagSites failed, falling back to heuristic:", err);
  }
  return sites.map((s) => heuristicTag(s, analysis));
}

// ---------------------------------------------------------------------------
// Heuristic fallbacks (no API key required)
// ---------------------------------------------------------------------------

function heuristicAnalysis(websiteText: string, icpText: string): SignalAnalysisResult {
  const text = `${icpText} ${websiteText}`.toLowerCase();

  const matchedIndustries = INDUSTRIES.filter((ind) => {
    const head = ind.split(" ")[0].toLowerCase();
    return text.includes(head) || text.includes(ind.toLowerCase());
  });

  const headcountMin = /enterprise|large|500\+|1000/.test(text)
    ? 500
    : /mid-?market|sme|pme/.test(text)
      ? 50
      : 50;

  const keywords = Array.from(
    new Set(
      text
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4)
    )
  ).slice(0, 25);

  const signals: Signal[] = [
    {
      category: "Firmographic",
      name: "Operates physical industrial sites",
      description: "Company runs one or more factories / production plants.",
      rationale: "Industrial footprint is the core qualifier for this offering.",
      importance: "high",
      sources: ["OpenStreetMap industrial tags", "company website", "registry data"],
    },
    {
      category: "Firmographic",
      name: `Headcount above ~${headcountMin}`,
      description: "Site or company employs enough staff to justify the solution.",
      rationale: "Scale correlates with budget and complexity of operations.",
      importance: "high",
      sources: ["LinkedIn", "registry data", "site headcount"],
    },
    {
      category: "Trigger event",
      name: "Recent hiring in operations / plant roles",
      description: "Open roles in production, maintenance, supply chain.",
      rationale: "Hiring signals growth or operational pain worth solving.",
      importance: "medium",
      sources: ["job boards", "careers page"],
    },
    {
      category: "Pain point",
      name: "Efficiency / sustainability pressure",
      description: "Public commitments or pressure around cost, energy or emissions.",
      rationale: "Indicates active budget for operational improvement.",
      importance: "medium",
      sources: ["press", "annual reports", "website"],
    },
  ];

  return {
    idealCustomerSummary:
      (icpText.trim() || "Industrial companies operating physical production sites") +
      (matchedIndustries.length
        ? `, with a focus on ${matchedIndustries.slice(0, 4).join(", ")}.`
        : "."),
    signals,
    keywords,
    suggestedFilters: {
      industries: matchedIndustries.length ? matchedIndustries : undefined,
      headcountMin,
    },
    heuristic: true,
  };
}

function heuristicTag(
  site: SiteForTagging,
  analysis: SignalAnalysisResult | null
): SiteTagResult {
  const tags: string[] = [];
  if (site.industry && site.industry !== "Other") {
    tags.push(site.industry.split(" ")[0].toLowerCase());
  }
  if (site.headcount != null) {
    tags.push(site.headcount >= 500 ? "large" : site.headcount >= 100 ? "mid-size" : "small");
  }
  if (site.turnoverEur != null && site.turnoverEur >= 100_000_000) tags.push("high-revenue");
  if (site.country) tags.push(site.country.toLowerCase());

  // Fit score: start neutral, reward overlap with the ICP's suggested filters.
  let score = 40;
  const f = analysis?.suggestedFilters;
  if (f?.industries?.includes(site.industry)) score += 25;
  if (f?.countries?.includes(site.country)) score += 10;
  if (site.headcount != null) {
    if (f?.headcountMin == null || site.headcount >= f.headcountMin) score += 15;
    if (f?.headcountMax != null && site.headcount > f.headcountMax) score -= 15;
  }
  if (site.turnoverEur != null && f?.turnoverMinEur != null) {
    if (site.turnoverEur >= f.turnoverMinEur) score += 10;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    id: site.id,
    tags: Array.from(new Set(tags)).slice(0, 5),
    fitScore: score,
    rationale: analysis
      ? "Heuristic score from overlap with ICP industry, geography and scale."
      : "Heuristic score from industry and scale (no ICP set).",
  };
}
