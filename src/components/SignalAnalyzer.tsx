"use client";

import { useState } from "react";
import Link from "next/link";
import type { SignalAnalysisResult, Signal } from "@/lib/types";

interface SavedProfile {
  id: string;
  name: string;
  analyzedAt: string | null;
  model: string | null;
}

const IMPORTANCE_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function mapHref(filters: SignalAnalysisResult["suggestedFilters"]): string {
  const p = new URLSearchParams();
  if (filters.industries?.length) p.set("industries", filters.industries.join(","));
  if (filters.countries?.length) p.set("countries", filters.countries.join(","));
  if (filters.headcountMin != null) p.set("headcountMin", String(filters.headcountMin));
  if (filters.headcountMax != null) p.set("headcountMax", String(filters.headcountMax));
  if (filters.turnoverMinEur != null)
    p.set("turnoverMinEur", String(filters.turnoverMinEur));
  return `/map?${p.toString()}`;
}

export function SignalAnalyzer({
  initialProfiles,
}: {
  initialProfiles: SavedProfile[];
}) {
  const [profiles, setProfiles] = useState<SavedProfile[]>(initialProfiles);
  const [profileId, setProfileId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [websiteText, setWebsiteText] = useState("");
  const [icpText, setIcpText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignalAnalysisResult | null>(null);
  const [usedHeuristic, setUsedHeuristic] = useState(false);

  async function analyze() {
    setError(null);
    if (!websiteText.trim() && !icpText.trim()) {
      setError("Paste some website copy and/or describe your ICP first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/signals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, name, websiteText, icpText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed.");
        return;
      }
      setResult(data.analysis);
      setUsedHeuristic(Boolean(data.analysis?.heuristic));
      setProfileId(data.profileId);
      // Refresh saved-profile list.
      const list = await fetch("/api/signals/profiles").then((r) => r.json());
      setProfiles(list.profiles ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(id: string) {
    setProfileId(id);
    setResult(null);
    setError(null);
    const res = await fetch(`/api/signals/profiles/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setName(data.profile.name);
    setWebsiteText(data.profile.websiteText);
    setIcpText(data.profile.icpText);
    if (data.profile.analysis) {
      setResult(data.profile.analysis);
      setUsedHeuristic(Boolean(data.profile.analysis.heuristic));
    }
  }

  function reset() {
    setProfileId(undefined);
    setName("");
    setWebsiteText("");
    setIcpText("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Input + results */}
      <div className="space-y-6">
        <div className="card p-5">
          <div className="mb-4">
            <label className="label">Profile name</label>
            <input
              className="input"
              placeholder="e.g. Mid-market food producers (FR)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Website copy</label>
              <textarea
                className="input h-44 resize-y font-mono text-xs"
                placeholder="Paste the company's homepage / product copy here…"
                value={websiteText}
                onChange={(e) => setWebsiteText(e.target.value)}
              />
            </div>
            <div>
              <label className="label">ICP description</label>
              <textarea
                className="input h-44 resize-y text-sm"
                placeholder="Describe who you sell to: industry, size, geography, pains…"
                value={icpText}
                onChange={(e) => setIcpText(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={analyze} disabled={loading}>
              {loading ? "Analyzing…" : result ? "Re-analyze" : "Analyze signals"}
            </button>
            <button className="btn-secondary" onClick={reset} disabled={loading}>
              New profile
            </button>
          </div>
        </div>

        {result && (
          <div className="space-y-5">
            {usedHeuristic && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                ⚙️ Generated with the built-in heuristic analyzer. Set{" "}
                <code>ANTHROPIC_API_KEY</code> for higher-quality AI analysis.
              </div>
            )}

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700">
                Ideal customer
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {result.idealCustomerSummary}
              </p>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Buying signals ({result.signals.length})
                </h3>
              </div>
              <ul className="space-y-3">
                {result.signals.map((s: Signal, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {s.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.category}
                        </p>
                      </div>
                      <span
                        className={`badge ${IMPORTANCE_STYLES[s.importance] || IMPORTANCE_STYLES.low}`}
                      >
                        {s.importance}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{s.description}</p>
                    <p className="mt-1 text-xs italic text-slate-500">
                      {s.rationale}
                    </p>
                    {s.sources?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.sources.map((src, j) => (
                          <span
                            key={j}
                            className="badge bg-slate-100 text-slate-600"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {result.keywords?.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  Keywords
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.keywords.map((k, i) => (
                    <span key={i} className="badge bg-brand-50 text-brand-700">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="card flex items-center justify-between p-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  Find matching sites
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Open the map pre-filtered to this ICP.
                </p>
              </div>
              <Link
                href={mapHref(result.suggestedFilters)}
                className="btn-primary"
              >
                View on map →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Saved profiles */}
      <aside>
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Saved profiles
          </h3>
          {profiles.length === 0 ? (
            <p className="text-sm text-slate-400">
              Your analyzed ICPs will appear here.
            </p>
          ) : (
            <ul className="space-y-1">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => loadProfile(p.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      p.id === profileId
                        ? "bg-brand-50 text-brand-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-xs text-slate-400">
                      {p.model === "heuristic" ? "heuristic" : "AI"} ·{" "}
                      {p.analyzedAt
                        ? new Date(p.analyzedAt).toLocaleDateString()
                        : "draft"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
