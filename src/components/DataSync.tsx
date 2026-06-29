"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/industries";

type RowStatus = "pending" | "running" | "done" | "error";
interface SyncRow {
  country: string;
  status: RowStatus;
  message?: string;
}

export function DataSync({
  initialCounts,
  initialTotal,
}: {
  initialCounts: Record<string, number>;
  initialTotal: number;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<string[]>(["FR"]);
  const [limit, setLimit] = useState(400);
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);

  function toggle(code: string) {
    setSelected((s) =>
      s.includes(code) ? s.filter((c) => c !== code) : [...s, code]
    );
  }

  async function refreshCounts() {
    const res = await fetch("/api/sites/sync");
    if (res.ok) {
      const data = await res.json();
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    }
  }

  async function sync() {
    if (!selected.length || running) return;
    setRunning(true);
    setRows(selected.map((c) => ({ country: c, status: "pending" as RowStatus })));

    for (const country of selected) {
      setRows((rs) =>
        rs.map((r) => (r.country === country ? { ...r, status: "running" } : r))
      );
      try {
        const res = await fetch("/api/sites/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, limit }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setRows((rs) =>
            rs.map((r) =>
              r.country === country
                ? { ...r, status: "error", message: data.error || "Failed" }
                : r
            )
          );
        } else {
          const { received, upserted, skipped } = data.result;
          setRows((rs) =>
            rs.map((r) =>
              r.country === country
                ? {
                    ...r,
                    status: "done",
                    message: `${upserted} imported · ${received} found · ${skipped} skipped`,
                  }
                : r
            )
          );
          await refreshCounts();
        }
      } catch {
        setRows((rs) =>
          rs.map((r) =>
            r.country === country
              ? { ...r, status: "error", message: "Network error" }
              : r
          )
        );
      }
    }
    setRunning(false);
  }

  async function clearSeed() {
    if (!confirm("Remove all sample (seed) sites? Imported OSM sites are kept.")) {
      return;
    }
    setClearing(true);
    try {
      await fetch("/api/sites/sync", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "seed" }),
      });
      await refreshCounts();
    } finally {
      setClearing(false);
    }
  }

  const seedCount = counts["seed"] || 0;
  const osmCount = counts["osm"] || 0;

  return (
    <div className="space-y-6">
      {/* Source summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total sites</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">From OpenStreetMap</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {osmCount.toLocaleString()}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Sample (seed)</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {seedCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Sync panel */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700">
          Sync industrial sites from OpenStreetMap
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pulls real industrial sites (factories, works, industrial land use)
          from OpenStreetMap. Safe to re-run — existing sites are updated, not
          duplicated. Headcount &amp; turnover aren&apos;t in OSM, so those stay
          empty until enriched.
        </p>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-slate-500">Countries</p>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => toggle(c.code)}
                disabled={running}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selected.includes(c.code)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {c.flag} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="label text-xs">Max sites per country</label>
            <input
              type="number"
              min={1}
              max={2000}
              className="input w-40"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={running}
            />
          </div>
          <button
            className="btn-primary"
            onClick={sync}
            disabled={running || !selected.length}
          >
            {running
              ? "Syncing…"
              : `Sync ${selected.length} ${selected.length === 1 ? "country" : "countries"}`}
          </button>
        </div>

        {/* Progress */}
        {rows.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.country}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <span className="w-10 font-medium text-slate-700">
                  {r.country}
                </span>
                <span>
                  {r.status === "pending" && <span className="text-slate-400">⏳</span>}
                  {r.status === "running" && <span className="text-brand-600">⟳</span>}
                  {r.status === "done" && <span className="text-emerald-600">✓</span>}
                  {r.status === "error" && <span className="text-red-600">✕</span>}
                </span>
                <span
                  className={`flex-1 ${r.status === "error" ? "text-red-600" : "text-slate-600"}`}
                >
                  {r.message ||
                    (r.status === "running"
                      ? "Querying OpenStreetMap…"
                      : "Waiting…")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Danger zone */}
      <div className="card border-amber-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Sample data</h2>
        <p className="mt-1 text-xs text-slate-500">
          The app ships with sample sites so the map is populated before any sync.
          Once you&apos;ve imported real OSM data, you can remove the samples.
        </p>
        <button
          className="btn-secondary mt-3"
          onClick={clearSeed}
          disabled={clearing || seedCount === 0}
        >
          {clearing
            ? "Removing…"
            : seedCount === 0
              ? "No sample data"
              : `Remove ${seedCount} sample sites`}
        </button>
      </div>
    </div>
  );
}
