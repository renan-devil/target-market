"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { INDUSTRIES, COUNTRIES } from "@/lib/industries";
import { RELATIONSHIPS } from "@/lib/types";
import type { SiteDTO } from "@/lib/serialize";
import { SiteDetail } from "./SiteDetail";

const SitesMap = dynamic(() => import("./SitesMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

const TAG_BATCH = 80;

export interface MapFilters {
  q: string;
  countries: string[];
  industries: string[];
  relationships: string[];
  headcountMin: string;
  headcountMax: string;
  fitMin: string;
}

interface Profile {
  id: string;
  name: string;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function toQuery(f: MapFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.countries.length) p.set("countries", f.countries.join(","));
  if (f.industries.length) p.set("industries", f.industries.join(","));
  if (f.relationships.length) p.set("relationships", f.relationships.join(","));
  if (f.headcountMin) p.set("headcountMin", f.headcountMin);
  if (f.headcountMax) p.set("headcountMax", f.headcountMax);
  if (f.fitMin) p.set("fitMin", f.fitMin);
  return p.toString();
}

export function MapExplorer({
  initialFilters,
  profiles,
  claudeEnabled,
}: {
  initialFilters: MapFilters;
  profiles: Profile[];
  claudeEnabled: boolean;
}) {
  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  const [sites, setSites] = useState<SiteDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [colorBy, setColorBy] = useState<"relationship" | "fit">("relationship");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [tagging, setTagging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSites = useCallback(async (f: MapFilters) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sites?${toQuery(f)}`);
      const data = await res.json();
      setSites(data.sites ?? []);
      setTotal(data.total ?? 0);
      setTruncated(Boolean(data.truncated));
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced refetch on filter change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSites(filters), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchSites]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedId) ?? null,
    [sites, selectedId]
  );

  function toggle(key: "countries" | "industries" | "relationships", value: string) {
    setFilters((f) => {
      const set = new Set(f[key]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...f, [key]: Array.from(set) };
    });
  }

  function patch(partial: Partial<MapFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function clearAll() {
    setFilters({
      q: "",
      countries: [],
      industries: [],
      relationships: [],
      headcountMin: "",
      headcountMax: "",
      fitMin: "",
    });
  }

  function onSiteUpdated(updated: SiteDTO) {
    setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function tagVisible() {
    if (!sites.length) return;
    setTagging(true);
    setNotice(null);
    const ids = sites.slice(0, TAG_BATCH).map((s) => s.id);
    try {
      const res = await fetch("/api/sites/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: ids, profileId: profileId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Tagging failed.");
        return;
      }
      const byId = new Map<string, SiteDTO>(
        (data.sites as SiteDTO[]).map((s) => [s.id, s])
      );
      setSites((prev) => prev.map((s) => byId.get(s.id) ?? s));
      setColorBy("fit");
      setNotice(
        `Scored ${data.sites.length} site(s)${
          data.scoredAgainstIcp ? " against the selected ICP" : ""
        }${data.usedClaude ? " with AI" : " (heuristic)"}.` +
          (sites.length > TAG_BATCH ? ` First ${TAG_BATCH} shown sites only.` : "")
      );
    } catch {
      setNotice("Network error.");
    } finally {
      setTagging(false);
    }
  }

  function exportCsv() {
    window.open(`/api/sites/export?${toQuery(filters)}`, "_blank");
  }

  const activeFilterCount =
    filters.countries.length +
    filters.industries.length +
    filters.relationships.length +
    (filters.q ? 1 : 0) +
    (filters.headcountMin ? 1 : 0) +
    (filters.headcountMax ? 1 : 0) +
    (filters.fitMin ? 1 : 0);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-slate-900">Industrial Map</h1>
        <span className="text-sm text-slate-500">
          {loading ? "Loading…" : `${total.toLocaleString()} sites`}
          {truncated && " (showing first 5,000)"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 text-xs">
            <button
              className={`px-3 py-1.5 ${colorBy === "relationship" ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}
              onClick={() => setColorBy("relationship")}
            >
              By relationship
            </button>
            <button
              className={`px-3 py-1.5 ${colorBy === "fit" ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}
              onClick={() => setColorBy("fit")}
            >
              By fit score
            </button>
          </div>

          <select
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            title="ICP profile to score against"
          >
            <option value="">No ICP (score by scale)</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            className="btn-secondary py-1.5 text-xs"
            onClick={tagVisible}
            disabled={tagging || !sites.length}
            title={`AI-tag & fit-score up to ${TAG_BATCH} shown sites`}
          >
            {tagging ? "Scoring…" : `✨ Tag & score ${claudeEnabled ? "(AI)" : "(heuristic)"}`}
          </button>

          <button
            className="btn-primary py-1.5 text-xs"
            onClick={exportCsv}
            disabled={!total}
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {notice && (
        <div className="border-b border-brand-100 bg-brand-50 px-6 py-1.5 text-xs text-brand-800">
          {notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Filters */}
        <div className="w-64 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <input
            className="input"
            placeholder="Search name, city…"
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Country</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => (
                <Chip
                  key={c.code}
                  active={filters.countries.includes(c.code)}
                  onClick={() => toggle("countries", c.code)}
                >
                  {c.flag} {c.code}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Industry</p>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map((ind) => (
                <Chip
                  key={ind}
                  active={filters.industries.includes(ind)}
                  onClick={() => toggle("industries", ind)}
                >
                  {ind}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              Relationship
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RELATIONSHIPS.map((r) => (
                <Chip
                  key={r.value}
                  active={filters.relationships.includes(r.value)}
                  onClick={() => toggle("relationships", r.value)}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Headcount</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input"
                placeholder="min"
                value={filters.headcountMin}
                onChange={(e) => patch({ headcountMin: e.target.value })}
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                className="input"
                placeholder="max"
                value={filters.headcountMax}
                onChange={(e) => patch({ headcountMax: e.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              Min fit score
            </p>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              placeholder="0–100"
              value={filters.fitMin}
              onChange={(e) => patch({ fitMin: e.target.value })}
            />
          </div>

          {/* Legend */}
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              {colorBy === "relationship" ? "Relationship legend" : "Fit legend"}
            </p>
            {colorBy === "relationship" ? (
              <div className="space-y-1">
                {RELATIONSHIPS.map((r) => (
                  <div key={r.value} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-slate-600">{r.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>low</span>
                <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-slate-300 via-brand-400 to-brand-700" />
                <span>high</span>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative min-w-0 flex-1">
          <SitesMap
            sites={sites}
            colorBy={colorBy}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Detail */}
        {selectedSite && (
          <div className="w-80 shrink-0 border-l border-slate-200 bg-white">
            <SiteDetail
              site={selectedSite}
              onClose={() => setSelectedId(null)}
              onUpdated={onSiteUpdated}
            />
          </div>
        )}
      </div>
    </div>
  );
}
