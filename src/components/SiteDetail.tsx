"use client";

import { useEffect, useState } from "react";
import { RELATIONSHIPS, relationshipMeta } from "@/lib/types";
import { countryLabel } from "@/lib/industries";
import type { SiteDTO } from "@/lib/serialize";

function fmtTurnover(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000_000) return `€${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v}`;
}

export function SiteDetail({
  site,
  onClose,
  onUpdated,
}: {
  site: SiteDTO;
  onClose: () => void;
  onUpdated: (site: SiteDTO) => void;
}) {
  const [accountName, setAccountName] = useState(site.accountName ?? "");
  const [relationship, setRelationship] = useState(site.relationship);
  const [saving, setSaving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setAccountName(site.accountName ?? "");
    setRelationship(site.relationship);
    setMsg(null);
  }, [site.id, site.accountName, site.relationship]);

  async function saveAccount() {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { relationship };
      if (accountName.trim()) body.accountName = accountName.trim();
      else body.accountId = null; // clearing the name unlinks
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Save failed.");
        return;
      }
      onUpdated(data.site);
      setMsg("Saved.");
    } catch {
      setMsg("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function aiTag() {
    setTagging(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sites/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: [site.id] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Tagging failed.");
        return;
      }
      if (data.sites?.[0]) onUpdated(data.sites[0]);
      setMsg(data.usedClaude ? "Tagged with AI." : "Tagged (heuristic).");
    } catch {
      setMsg("Network error.");
    } finally {
      setTagging(false);
    }
  }

  const meta = relationshipMeta(site.relationship);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-slate-200 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">
            {site.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {[site.city, countryLabel(site.country)].filter(Boolean).join(", ")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-slate-100 text-slate-700">{site.industry}</span>
          {site.fitScore != null && (
            <span className="badge bg-brand-50 text-brand-700">
              Fit {site.fitScore}
            </span>
          )}
          <span
            className="badge text-white"
            style={{ backgroundColor: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Headcount</dt>
            <dd className="font-medium text-slate-800">
              {site.headcount?.toLocaleString() ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Turnover</dt>
            <dd className="font-medium text-slate-800">
              {fmtTurnover(site.turnoverEur)}
            </dd>
          </div>
          {site.sector && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">Sector</dt>
              <dd className="text-slate-800">{site.sector}</dd>
            </div>
          )}
          {site.address && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">Address</dt>
              <dd className="text-slate-800">{site.address}</dd>
            </div>
          )}
          {site.website && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">Website</dt>
              <dd>
                <a
                  href={site.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  {site.website.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {site.description && (
          <p className="text-sm text-slate-600">{site.description}</p>
        )}

        {site.tags.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-slate-400">Tags</p>
            <div className="flex flex-wrap gap-1">
              {site.tags.map((t) => (
                <span key={t} className="badge bg-emerald-50 text-emerald-700">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={aiTag}
          disabled={tagging}
          className="btn-secondary w-full"
        >
          {tagging ? "Tagging…" : "✨ AI tag this site"}
        </button>

        {/* Account penetration editor */}
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Account & relationship
          </p>
          <label className="label text-xs">Account name</label>
          <input
            className="input"
            placeholder="Link to an OSS account…"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <label className="label mt-3 text-xs">Relationship</label>
          <select
            className="input"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={saveAccount}
            disabled={saving}
            className="btn-primary mt-3 w-full"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {msg && <p className="text-center text-xs text-slate-500">{msg}</p>}
      </div>
    </div>
  );
}
